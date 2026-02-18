import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

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
        const { token, phoneNumberId, to, type, content, templateName, templateParams } = params;
        let messageBody: any = { messaging_product: 'whatsapp', to };

        if (type === 'template' && templateName) {
          messageBody.type = 'template';
          messageBody.template = {
            name: templateName, language: { code: 'en' },
            components: templateParams ? [{ type: 'body', parameters: Object.values(templateParams).map((v: any) => ({ type: 'text', text: v })) }] : [],
          };
        } else if (type === 'image') {
          messageBody.type = 'image';
          messageBody.image = { link: content };
        } else if (type === 'document') {
          messageBody.type = 'document';
          messageBody.document = { link: content };
        } else if (type === 'audio') {
          messageBody.type = 'audio';
          messageBody.audio = { link: content };
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
          return new Response(JSON.stringify({ success: false, error: data.error?.message || 'Failed to send message' }),
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
