import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

const normalizeRecipient = (value: string): string => value.replace(/\D/g, '');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { action, ...params } = await req.json();
    console.log('WhatsApp API action:', action);

    switch (action) {
      case 'test_connection': {
        const { token, phoneNumberId } = params;
        const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          const error = await response.json();
          return new Response(JSON.stringify({ success: false, error: error.error?.message || 'Connection failed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const data = await response.json();
        return new Response(JSON.stringify({ success: true, phoneNumber: data.display_phone_number }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'sync_templates': {
        const { token, businessAccountId, userId } = params;
        const response = await fetch(`${WHATSAPP_API_URL}/${businessAccountId}/message_templates`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          const error = await response.json();
          return new Response(JSON.stringify({ success: false, error: error.error?.message || 'Failed to fetch templates' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const data = await response.json();
        const templates = data.data || [];
        await supabase.from('whatsapp_templates').delete().eq('user_id', userId);
        if (templates.length > 0) {
          await supabase.from('whatsapp_templates').insert(
            templates.map((t: any) => ({
              user_id: userId, template_id: t.id, name: t.name,
              language: t.language, category: t.category, status: t.status, components: t.components,
            }))
          );
        }
        return new Response(JSON.stringify({ success: true, count: templates.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'send_message': {
        const { token, phoneNumberId, to, type, content, templateName, templateParams, templateLanguage, mediaFileName, mediaMimeType } = params;
        const normalizedTo = normalizeRecipient(String(to || ''));
        if (!normalizedTo || normalizedTo.length < 8) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid recipient phone number. Include country code, e.g. 234XXXXXXXXXX.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Best-effort recipient validation before send.
        try {
          const contactsRes = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/contacts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', blocking: 'wait', contacts: [normalizedTo] }),
          });

          if (contactsRes.ok) {
            const contactsData = await contactsRes.json();
            const status = contactsData?.contacts?.[0]?.status;
            if (status && status !== 'valid') {
              return new Response(JSON.stringify({ success: false, error: `Recipient number is not valid on WhatsApp (${status}).` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          }
        } catch {
          // Non-fatal: continue with send attempt.
        }

        let messageBody: any = { messaging_product: 'whatsapp', to: normalizedTo };

        if (type === 'template' && templateName) {
          const orderedParams = templateParams
            ? Object.entries(templateParams)
                .sort(([a], [b]) => {
                  const numA = parseInt(String(a).replace(/\D/g, ''), 10);
                  const numB = parseInt(String(b).replace(/\D/g, ''), 10);
                  if (Number.isNaN(numA) || Number.isNaN(numB)) return String(a).localeCompare(String(b));
                  return numA - numB;
                })
                .map(([, v]) => ({ type: 'text', text: String(v ?? '') }))
            : [];

          messageBody.type = 'template';
          messageBody.template = {
            name: templateName,
            language: { code: templateLanguage || 'en' },
            components: orderedParams.length > 0 ? [{ type: 'body', parameters: orderedParams }] : [],
          };
        } else if (type === 'image') {
          messageBody.type = 'image';
          messageBody.image = { link: content };
        } else if (type === 'document') {
          messageBody.type = 'document';
          messageBody.document = { link: content };
        } else if (type === 'audio') {
          messageBody.type = 'audio';

          try {
            // Prefer WhatsApp-hosted media for audio reliability (OGG/OPUS etc).
            const mediaResponse = await fetch(content);
            if (!mediaResponse.ok) throw new Error('Failed to fetch audio URL');

            const mediaBlob = await mediaResponse.blob();
            const uploadForm = new FormData();
            uploadForm.append('messaging_product', 'whatsapp');

            const resolvedMime = (mediaMimeType || mediaBlob.type || 'audio/mp4').toLowerCase();
            const normalizedMime = resolvedMime.includes('mp4') || resolvedMime.includes('m4a') || resolvedMime.includes('aac')
              ? 'audio/mp4'
              : resolvedMime.includes('ogg')
                ? 'audio/ogg'
                : resolvedMime.includes('mpeg')
                  ? 'audio/mpeg'
                  : resolvedMime.includes('amr')
                    ? 'audio/amr'
                    : resolvedMime;

            uploadForm.append('type', normalizedMime);
            uploadForm.append('file', mediaBlob, mediaFileName || 'voice.m4a');

            const uploadRes = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/media`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: uploadForm,
            });

            const uploadData = await uploadRes.json();
            if (!uploadRes.ok || !uploadData?.id) {
              throw new Error(uploadData?.error?.message || 'Failed to upload audio media');
            }

            messageBody.audio = { id: uploadData.id };
          } catch (_error) {
            // Fallback to link flow if media upload fails.
            messageBody.audio = { link: content };
          }
        } else {
          messageBody.type = 'text';
          messageBody.text = { body: content };
        }

        const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(messageBody),
        });
        const data = await response.json();
        if (!response.ok) {
          const details = [data?.error?.message, data?.error?.error_data?.details, data?.error?.type, data?.error?.code]
            .filter(Boolean)
            .join(' | ');
          return new Response(JSON.stringify({ success: false, error: details || 'Failed to send message' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: true, messageId: data.messages?.[0]?.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_media': {
        const { token, mediaId } = params;
        const response = await fetch(`${WHATSAPP_API_URL}/${mediaId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
          return new Response(JSON.stringify({ success: false, error: 'Failed to get media' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const data = await response.json();
        return new Response(JSON.stringify({ success: true, url: data.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_business_profile': {
        const { token, phoneNumberId } = params;
        const phoneResponse = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        let phoneNumber = '';
        if (phoneResponse.ok) {
          const phoneData = await phoneResponse.json();
          phoneNumber = phoneData.display_phone_number || '';
        }
        const profileResponse = await fetch(
          `${WHATSAPP_API_URL}/${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!profileResponse.ok) {
          return new Response(JSON.stringify({ success: false, error: 'Failed to get business profile' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const profileData = await profileResponse.json();
        const profile = profileData.data?.[0] || {};
        return new Response(JSON.stringify({ 
          success: true, phoneNumber,
          profile: {
            name: profile.vertical || 'Business', description: profile.about || profile.description,
            address: profile.address, email: profile.email, website: profile.websites?.[0],
            vertical: profile.vertical, profilePictureUrl: profile.profile_picture_url,
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('WhatsApp API error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
