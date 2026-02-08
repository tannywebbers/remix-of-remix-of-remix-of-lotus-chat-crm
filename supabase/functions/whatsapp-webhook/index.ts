import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('user_id');

  console.log('Webhook request:', req.method, 'userId:', userId);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Handle webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('Verification request:', { mode, token, challenge, userId });

    if (mode === 'subscribe' && userId) {
      // Get user's verify token from database
      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('verify_token')
        .eq('user_id', userId)
        .single();

      if (settings && settings.verify_token === token) {
        console.log('Webhook verified successfully');
        return new Response(challenge, { status: 200 });
      }
    }

    console.log('Webhook verification failed');
    return new Response('Forbidden', { status: 403 });
  }

  // Handle incoming messages (POST request from Meta)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Incoming webhook:', JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) {
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Handle incoming messages
      if (value.messages && value.messages.length > 0) {
        for (const message of value.messages) {
          const from = message.from;
          const messageId = message.id;
          const timestamp = new Date(parseInt(message.timestamp) * 1000);
          
          let content = '';
          let type = 'text';
          let mediaUrl = null;

          if (message.type === 'text') {
            content = message.text?.body || '';
          } else if (message.type === 'image') {
            type = 'image';
            content = '[Image]';
            // Media ID would need to be downloaded separately
            mediaUrl = message.image?.id;
          } else if (message.type === 'document') {
            type = 'document';
            content = message.document?.filename || '[Document]';
            mediaUrl = message.document?.id;
          } else if (message.type === 'audio') {
            type = 'audio';
            content = '[Voice Message]';
            mediaUrl = message.audio?.id;
          } else if (message.type === 'video') {
            type = 'video';
            content = '[Video]';
            mediaUrl = message.video?.id;
          }

          // Find the contact by phone number
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, user_id')
            .eq('phone', from);

          if (contacts && contacts.length > 0) {
            for (const contact of contacts) {
              // Insert message for each matching contact
              const { error } = await supabase
                .from('messages')
                .insert({
                  user_id: contact.user_id,
                  contact_id: contact.id,
                  content,
                  type,
                  status: 'delivered',
                  is_outgoing: false,
                  media_url: mediaUrl,
                  whatsapp_message_id: messageId,
                });

              if (error) {
                console.error('Error inserting message:', error);
              } else {
                console.log('Message inserted for contact:', contact.id);
              }

              // Update contact last seen
              await supabase
                .from('contacts')
                .update({ 
                  last_seen: timestamp.toISOString(),
                  is_online: true 
                })
                .eq('id', contact.id);
            }
          } else {
            console.log('No contact found for phone:', from);
          }
        }
      }

      // Handle message status updates
      if (value.statuses && value.statuses.length > 0) {
        for (const status of value.statuses) {
          const messageId = status.id;
          const newStatus = status.status; // sent, delivered, read, failed

          console.log('Status update:', messageId, newStatus);

          const { error } = await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('whatsapp_message_id', messageId);

          if (error) {
            console.error('Error updating message status:', error);
          }
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
