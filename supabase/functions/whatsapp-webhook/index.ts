import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

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

    if (mode === 'subscribe' && userId) {
      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('verify_token')
        .eq('user_id', userId)
        .single();

      if (settings && settings.verify_token === token) {
        console.log('✅ Webhook verified');
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
      console.log('📨 Webhook payload received');

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) {
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Handle incoming messages
      if (value.messages?.length > 0) {
        // Get WhatsApp API token
        const { data: settings } = await supabase
          .from('whatsapp_settings')
          .select('api_token, user_id')
          .eq('is_connected', true)
          .limit(1)
          .single();

        const whatsappToken = settings?.api_token;
        const settingsUserId = settings?.user_id;

        if (!whatsappToken) {
          console.error('❌ No WhatsApp API token found');
          return new Response('OK', { status: 200, headers: corsHeaders });
        }

        for (const message of value.messages) {
          const from = message.from;
          const messageId = message.id;
          const timestamp = new Date(parseInt(message.timestamp) * 1000);

          let content = '';
          let type = 'text';
          let mediaUrl = null;

          // CRITICAL: Download media from WhatsApp and upload to Supabase storage
          const downloadAndUploadMedia = async (mediaId: string, mediaType: string): Promise<string | null> => {
            try {
              console.log(`📥 Downloading ${mediaType} from WhatsApp...`);
              
              // Step 1: Get media URL from WhatsApp
              const mediaInfoResponse = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${whatsappToken}` },
              });
              
              if (!mediaInfoResponse.ok) {
                console.error('❌ Failed to get media info');
                return null;
              }

              const mediaInfo = await mediaInfoResponse.json();
              const mediaFileUrl = mediaInfo.url;

              if (!mediaFileUrl) {
                console.error('❌ No URL in media info');
                return null;
              }

              // Step 2: Download the actual media file from WhatsApp
              console.log('📥 Downloading media file...');
              const mediaResponse = await fetch(mediaFileUrl, {
                headers: { 'Authorization': `Bearer ${whatsappToken}` },
              });

              if (!mediaResponse.ok) {
                console.error('❌ Failed to download media file');
                return null;
              }

              // Step 3: Get the file as a blob
              const mediaBlob = await mediaResponse.blob();
              console.log(`✅ Downloaded ${mediaBlob.size} bytes`);

              // Step 4: Determine file extension
              const mimeType = mediaInfo.mime_type || mediaResponse.headers.get('content-type') || 'application/octet-stream';
              let extension = 'bin';
              
              if (mimeType.includes('image/jpeg') || mimeType.includes('image/jpg')) extension = 'jpg';
              else if (mimeType.includes('image/png')) extension = 'png';
              else if (mimeType.includes('image/webp')) extension = 'webp';
              else if (mimeType.includes('video/mp4')) extension = 'mp4';
              else if (mimeType.includes('audio/ogg')) extension = 'ogg';
              else if (mimeType.includes('audio/mpeg')) extension = 'mp3';
              else if (mimeType.includes('audio/opus')) extension = 'opus';
              else if (mimeType.includes('audio/')) extension = 'webm';
              else if (mimeType.includes('application/pdf')) extension = 'pdf';
              else if (mimeType.includes('application/vnd.openxmlformats-officedocument')) extension = 'docx';

              // Step 5: Upload to Supabase storage
              const fileName = `whatsapp/${from}/${Date.now()}.${extension}`;
              console.log(`📤 Uploading to storage: ${fileName}`);

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(fileName, mediaBlob, {
                  contentType: mimeType,
                  cacheControl: '3600',
                });

              if (uploadError) {
                console.error('❌ Upload error:', uploadError);
                return null;
              }

              // Step 6: Get public URL
              const { data: urlData } = supabase.storage
                .from('chat-media')
                .getPublicUrl(fileName);

              console.log('✅ Media uploaded successfully');
              return urlData.publicUrl;

            } catch (err) {
              console.error('❌ Error downloading/uploading media:', err);
              return null;
            }
          };

          // Handle different message types
          switch (message.type) {
            case 'text':
              content = message.text?.body || '';
              break;

            case 'button':
              // FIXED: Handle button response
              content = message.button?.text || message.button?.payload || '[Button]';
              type = 'text';
              console.log('🔘 Button clicked:', content);
              break;

            case 'interactive':
              // Handle button clicks from templates
              if (message.interactive?.type === 'button_reply') {
                content = message.interactive.button_reply.title || '[Button]';
                type = 'text';
                console.log('🔘 Interactive button:', content);
              } else if (message.interactive?.type === 'list_reply') {
                content = message.interactive.list_reply.title || '[List item]';
                type = 'text';
              }
              break;

            case 'image':
              type = 'image';
              content = message.image?.caption || '[Image]';
              if (message.image?.id) {
                mediaUrl = await downloadAndUploadMedia(message.image.id, 'image');
              }
              break;

            case 'document':
              type = 'document';
              content = message.document?.filename || '[Document]';
              if (message.document?.id) {
                mediaUrl = await downloadAndUploadMedia(message.document.id, 'document');
              }
              break;

            case 'audio':
              type = 'audio';
              content = '[Voice Message]';
              if (message.audio?.id) {
                mediaUrl = await downloadAndUploadMedia(message.audio.id, 'audio');
              }
              break;

            case 'video':
              type = 'video';
              content = '[Video]';
              if (message.video?.id) {
                mediaUrl = await downloadAndUploadMedia(message.video.id, 'video');
              }
              break;

            case 'sticker':
              type = 'image';
              content = '[Sticker]';
              if (message.sticker?.id) {
                mediaUrl = await downloadAndUploadMedia(message.sticker.id, 'sticker');
              }
              break;

            default:
              content = `[${message.type}]`;
              break;
          }

          // Find contacts with this phone number
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, user_id, name')
            .eq('phone', from);

          let targetUserId = userId || settingsUserId;
          let contactId = null;

          if (contacts && contacts.length > 0) {
            // Use existing contact
            contactId = contacts[0].id;
            targetUserId = contacts[0].user_id;

            // Update online status
            await supabase.from('contacts').update({
              last_seen: new Date().toISOString(),
              is_online: true,
            }).eq('id', contactId);

          } else if (targetUserId) {
            // Auto-create contact
            console.log('👤 Auto-creating contact for:', from);
            const contactName = value.contacts?.[0]?.profile?.name || from;

            const { data: newContact, error: createError } = await supabase.from('contacts').insert({
              user_id: targetUserId,
              name: contactName,
              phone: from,
              loan_id: `WA-${Date.now()}`,
              last_seen: new Date().toISOString(),
              is_online: true,
            }).select().single();

            if (!createError && newContact) {
              contactId = newContact.id;
              console.log('✅ Contact created:', contactId);
            }
          }

          // Insert message
          if (contactId && targetUserId) {
            const { error: msgError } = await supabase.from('messages').insert({
              user_id: targetUserId,
              contact_id: contactId,
              content,
              type,
              status: 'delivered',
              is_outgoing: false,
              media_url: mediaUrl,
              whatsapp_message_id: messageId,
            });

            if (msgError) {
              console.error('❌ Insert message error:', msgError);
            } else {
              console.log('✅ Message saved:', { type, hasMedia: !!mediaUrl, content: content.substring(0, 30) });
            }
          }
        }
      }

      // Handle status updates (sent, delivered, read, failed)
      if (value.statuses?.length > 0) {
        for (const status of value.statuses) {
          const waMessageId = status.id;
          const newStatus = status.status;

          await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('whatsapp_message_id', waMessageId);

          console.log('✅ Status updated:', newStatus);
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error('❌ Webhook error:', error);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response('Method not allowed', { status: 405 });
});
