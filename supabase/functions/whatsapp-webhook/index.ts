import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id');

  console.log('Webhook request:', req.method, 'userId:', userId);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Webhook verification (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Verification:', { mode, token, challenge, userId });

    if (mode === 'subscribe' && userId) {
      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('verify_token')
        .eq('user_id', userId)
        .single();

      if (settings && settings.verify_token === token) {
        console.log('Webhook verified');
        await supabase.from('whatsapp_settings').update({ is_connected: true }).eq('user_id', userId);
        return new Response(challenge, { status: 200 });
      }
    }

    return new Response('Forbidden', { status: 403 });
  }

  // Incoming messages & status updates (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Webhook payload:', JSON.stringify(body).substring(0, 500));

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) {
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Handle incoming messages
      if (value.messages?.length > 0) {
        for (const message of value.messages) {
          const from = message.from;
          const messageId = message.id;
          const timestamp = new Date(parseInt(message.timestamp) * 1000);

          let content = '';
          let type = 'text';
          let mediaUrl = null;

          switch (message.type) {
            case 'text': content = message.text?.body || ''; break;
            case 'image': type = 'image'; content = message.image?.caption || '[Image]'; mediaUrl = message.image?.id; break;
            case 'document': type = 'document'; content = message.document?.filename || '[Document]'; mediaUrl = message.document?.id; break;
            case 'audio': type = 'audio'; content = '[Voice Message]'; mediaUrl = message.audio?.id; break;
            case 'video': type = 'video'; content = '[Video]'; mediaUrl = message.video?.id; break;
            default: content = `[${message.type}]`; break;
          }

          // Find all contacts with this phone number
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, user_id')
            .eq('phone', from);

          if (contacts && contacts.length > 0) {
            for (const contact of contacts) {
              const { error } = await supabase.from('messages').insert({
                user_id: contact.user_id, contact_id: contact.id,
                content, type, status: 'delivered', is_outgoing: false,
                media_url: mediaUrl, whatsapp_message_id: messageId,
              });
              if (error) console.error('Insert message error:', error);
              else console.log('Message inserted for contact:', contact.id);

              await supabase.from('contacts').update({
                last_seen: timestamp.toISOString(), is_online: true,
              }).eq('id', contact.id);
            }
          } else {
            // AUTO-CREATE CONTACT for unknown numbers
            // Find which user this webhook belongs to (from userId param or find settings by phone)
            let targetUserId = userId;

            if (!targetUserId) {
              // Try to find user from whatsapp_settings
              const { data: allSettings } = await supabase
                .from('whatsapp_settings')
                .select('user_id')
                .eq('is_connected', true)
                .limit(1);
              if (allSettings && allSettings.length > 0) {
                targetUserId = allSettings[0].user_id;
              }
            }

            if (targetUserId) {
              console.log('Auto-creating contact for phone:', from, 'user:', targetUserId);

              // Get contact name from WhatsApp profile if available
              const contactName = value.contacts?.[0]?.profile?.name || from;

              const { data: newContact, error: createError } = await supabase.from('contacts').insert({
                user_id: targetUserId,
                name: contactName,
                phone: from,
                loan_id: `WA-${Date.now()}`,
              }).select().single();

              if (createError) {
                console.error('Auto-create contact error:', createError);
              } else if (newContact) {
                console.log('Contact auto-created:', newContact.id);

                const { error: msgError } = await supabase.from('messages').insert({
                  user_id: targetUserId, contact_id: newContact.id,
                  content, type, status: 'delivered', is_outgoing: false,
                  media_url: mediaUrl, whatsapp_message_id: messageId,
                });
                if (msgError) console.error('Insert message for new contact error:', msgError);

                await supabase.from('contacts').update({
                  last_seen: timestamp.toISOString(), is_online: true,
                }).eq('id', newContact.id);
              }
            } else {
              console.log('No user found for incoming message from:', from);
            }
          }
        }
      }

      // Handle status updates (sent, delivered, read, failed)
      if (value.statuses?.length > 0) {
        for (const status of value.statuses) {
          const waMessageId = status.id;
          const newStatus = status.status; // sent, delivered, read, failed
          console.log('Status update:', waMessageId, '->', newStatus);

          const { error } = await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('whatsapp_message_id', waMessageId);

          if (error) console.error('Status update error:', error);
          else console.log('Status updated:', waMessageId, newStatus);
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response('Method not allowed', { status: 405 });
});
