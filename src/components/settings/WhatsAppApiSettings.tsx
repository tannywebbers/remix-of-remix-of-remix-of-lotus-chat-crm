import { useState, useEffect } from 'react';
import { Key, Smartphone, Building, Link, TestTube, Copy, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppApiSettingsProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function WhatsAppApiSettings({ onConnectionChange }: WhatsAppApiSettingsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [webhookGenerated, setWebhookGenerated] = useState(false);
  
  const [settings, setSettings] = useState({
    apiToken: '',
    phoneNumberId: '',
    businessAccountId: '',
    webhookUrl: '',
    verifyToken: '',
    isConnected: false,
  });

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          apiToken: data.api_token || '',
          phoneNumberId: data.phone_number_id || '',
          businessAccountId: data.business_account_id || '',
          webhookUrl: data.webhook_url || '',
          verifyToken: data.verify_token || '',
          isConnected: data.is_connected || false,
        });
        setWebhookGenerated(!!data.webhook_url);
        onConnectionChange?.(data.is_connected || false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateVerifyToken = () => {
    return 'lotus_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!settings.apiToken || !settings.phoneNumberId) {
      toast({ title: 'Missing required fields', description: 'Please enter API Token and Phone Number ID', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('whatsapp_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let error;
      if (existing) {
        // Update
        ({ error } = await supabase
          .from('whatsapp_settings')
          .update({
            api_token: settings.apiToken,
            phone_number_id: settings.phoneNumberId,
            business_account_id: settings.businessAccountId,
            webhook_url: settings.webhookUrl,
            verify_token: settings.verifyToken,
            is_connected: settings.isConnected,
          })
          .eq('user_id', user.id));
      } else {
        // Insert
        ({ error } = await supabase
          .from('whatsapp_settings')
          .insert({
            user_id: user.id,
            api_token: settings.apiToken,
            phone_number_id: settings.phoneNumberId,
            business_account_id: settings.businessAccountId,
            webhook_url: settings.webhookUrl,
            verify_token: settings.verifyToken,
            is_connected: settings.isConnected,
          }));
      }

      if (error) throw error;
      toast({ title: 'Settings saved successfully' });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({ title: 'Error saving settings', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWebhook = async () => {
    if (!user) return;
    if (!settings.apiToken || !settings.phoneNumberId) {
      toast({ title: 'Save credentials first', description: 'Please enter and save your API credentials before generating webhook', variant: 'destructive' });
      return;
    }

    const verifyToken = generateVerifyToken();
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?user_id=${user.id}`;
    
    const newSettings = { ...settings, webhookUrl, verifyToken };
    setSettings(newSettings);
    setWebhookGenerated(true);

    // Save immediately
    try {
      const { data: existing } = await supabase.from('whatsapp_settings').select('id').eq('user_id', user.id).maybeSingle();
      
      if (existing) {
        await supabase.from('whatsapp_settings').update({
          api_token: newSettings.apiToken,
          phone_number_id: newSettings.phoneNumberId,
          business_account_id: newSettings.businessAccountId,
          webhook_url: webhookUrl,
          verify_token: verifyToken,
          is_connected: newSettings.isConnected,
        }).eq('user_id', user.id);
      } else {
        await supabase.from('whatsapp_settings').insert({
          user_id: user.id,
          api_token: newSettings.apiToken,
          phone_number_id: newSettings.phoneNumberId,
          business_account_id: newSettings.businessAccountId,
          webhook_url: webhookUrl,
          verify_token: verifyToken,
          is_connected: newSettings.isConnected,
        });
      }

      toast({ title: 'Webhook generated!', description: 'Copy the URL and verify token to Meta.' });
    } catch (error) {
      console.error('Error saving webhook:', error);
      toast({ title: 'Error saving webhook', variant: 'destructive' });
    }
  };

  const handleTestConnection = async () => {
    if (!settings.apiToken || !settings.phoneNumberId) {
      toast({ title: 'Missing credentials', description: 'Please enter API token and Phone Number ID', variant: 'destructive' });
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'test_connection', token: settings.apiToken, phoneNumberId: settings.phoneNumberId },
      });

      if (error) throw error;

      if (data?.success) {
        const newSettings = { ...settings, isConnected: true };
        setSettings(newSettings);
        onConnectionChange?.(true);
        
        // Persist connected state
        const { data: existing } = await supabase.from('whatsapp_settings').select('id').eq('user_id', user!.id).maybeSingle();
        if (existing) {
          await supabase.from('whatsapp_settings').update({ is_connected: true }).eq('user_id', user!.id);
        }

        toast({ title: 'Connection successful!', description: `Connected to ${data.phoneNumber || 'WhatsApp'}` });
      } else {
        throw new Error(data?.error || 'Connection failed');
      }
    } catch (error: any) {
      setSettings(prev => ({ ...prev, isConnected: false }));
      onConnectionChange?.(false);
      toast({ title: 'Connection failed', description: error.message || 'Please check your credentials', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncTemplates = async () => {
    if (!settings.apiToken || !settings.businessAccountId) {
      toast({ title: 'Missing credentials', description: 'Please enter API token and Business Account ID', variant: 'destructive' });
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'sync_templates', token: settings.apiToken, businessAccountId: settings.businessAccountId, userId: user?.id },
      });
      if (error) throw error;
      toast({ title: 'Templates synced', description: `${data?.count || 0} templates imported` });
    } catch (error: any) {
      toast({ title: 'Sync failed', description: error.message || 'Failed to sync templates', variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Banner */}
      {settings.isConnected && (
        <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <div>
            <p className="font-semibold text-[15px] text-primary">Connected to WhatsApp</p>
            <p className="text-[13px] text-muted-foreground">Your WhatsApp Business API is active</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[17px]">
                <Key className="h-5 w-5 text-primary" />
                API Credentials
              </CardTitle>
              <CardDescription className="text-[13px]">
                Enter your WhatsApp Cloud API credentials from Meta Business Suite
              </CardDescription>
            </div>
            <Badge variant={settings.isConnected ? 'default' : 'secondary'} className="text-[11px]">
              {settings.isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiToken" className="text-[14px] font-medium">Access Token *</Label>
            <Input
              id="apiToken" type="password" value={settings.apiToken}
              onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
              placeholder="Enter your permanent access token" className="text-[15px]"
            />
            <p className="text-[12px] text-muted-foreground">
              Get this from Meta Business Suite → WhatsApp → API Setup → Permanent Token
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId" className="flex items-center gap-1.5 text-[14px] font-medium">
                <Smartphone className="h-3.5 w-3.5" /> Phone Number ID *
              </Label>
              <Input id="phoneNumberId" value={settings.phoneNumberId}
                onChange={(e) => setSettings({ ...settings, phoneNumberId: e.target.value })}
                placeholder="123456789012345" className="text-[15px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAccountId" className="flex items-center gap-1.5 text-[14px] font-medium">
                <Building className="h-3.5 w-3.5" /> Business Account ID
              </Label>
              <Input id="businessAccountId" value={settings.businessAccountId}
                onChange={(e) => setSettings({ ...settings, businessAccountId: e.target.value })}
                placeholder="987654321098765" className="text-[15px]"
              />
              <p className="text-[12px] text-muted-foreground">Required for template sync</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="text-[15px]">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Credentials
            </Button>
            <Button variant="outline" onClick={handleTestConnection}
              disabled={testing || !settings.apiToken || !settings.phoneNumberId} className="text-[15px]">
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[17px]">
            <Link className="h-5 w-5 text-primary" /> Webhook Configuration
          </CardTitle>
          <CardDescription className="text-[13px]">
            Generate your unique webhook URL to receive messages from WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!webhookGenerated ? (
            <div className="text-center py-6">
              <p className="text-[14px] text-muted-foreground mb-4">
                After saving your credentials, generate a webhook URL to receive incoming messages
              </p>
              <Button onClick={handleGenerateWebhook} disabled={!settings.apiToken || !settings.phoneNumberId} className="text-[15px]">
                <Link className="h-4 w-4 mr-2" /> Generate Webhook URL
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium">Callback URL</Label>
                <div className="flex gap-2">
                  <Input value={settings.webhookUrl} readOnly className="bg-muted font-mono text-[12px]" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(settings.webhookUrl, 'Webhook URL')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium">Verify Token</Label>
                <div className="flex gap-2">
                  <Input value={settings.verifyToken} readOnly className="bg-muted font-mono text-[12px]" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(settings.verifyToken, 'Verify token')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="p-4 bg-muted rounded-xl">
                <h4 className="font-semibold text-[14px] mb-2">Setup Instructions:</h4>
                <ol className="text-[13px] text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Go to <strong>Meta Business Suite → WhatsApp → Configuration</strong></li>
                  <li>Click <strong>"Edit"</strong> on the Webhook section</li>
                  <li>Paste the <strong>Callback URL</strong> above</li>
                  <li>Paste the <strong>Verify Token</strong> above</li>
                  <li>Subscribe to <strong>"messages"</strong> webhook field</li>
                  <li>Click <strong>"Verify and Save"</strong></li>
                </ol>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[17px]">Message Templates</CardTitle>
          <CardDescription className="text-[13px]">Sync your approved WhatsApp message templates</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSyncTemplates}
            disabled={syncing || !settings.apiToken || !settings.businessAccountId || !settings.isConnected} className="text-[15px]">
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Templates
          </Button>
          {!settings.isConnected && (
            <p className="text-[12px] text-muted-foreground mt-2">Connect your API first to sync templates</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
