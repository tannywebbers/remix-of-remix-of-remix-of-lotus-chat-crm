import { useState, useEffect } from 'react';
import { Key, Smartphone, Building, Link, TestTube, Copy, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
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
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const typedData = data as any;
        setSettings({
          apiToken: typedData.api_token || '',
          phoneNumberId: typedData.phone_number_id || '',
          businessAccountId: typedData.business_account_id || '',
          webhookUrl: typedData.webhook_url || '',
          verifyToken: typedData.verify_token || '',
          isConnected: typedData.is_connected || false,
        });
        setWebhookGenerated(!!typedData.webhook_url);
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
      toast({ 
        title: 'Missing required fields', 
        description: 'Please enter API Token and Phone Number ID',
        variant: 'destructive' 
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('whatsapp_settings' as any)
        .upsert({
          user_id: user.id,
          api_token: settings.apiToken,
          phone_number_id: settings.phoneNumberId,
          business_account_id: settings.businessAccountId,
          webhook_url: settings.webhookUrl,
          verify_token: settings.verifyToken,
          is_connected: settings.isConnected,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({ title: 'Settings saved successfully' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ title: 'Error saving settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWebhook = async () => {
    if (!user) return;
    if (!settings.apiToken || !settings.phoneNumberId) {
      toast({ 
        title: 'Save credentials first', 
        description: 'Please enter and save your API credentials before generating webhook',
        variant: 'destructive' 
      });
      return;
    }

    const verifyToken = generateVerifyToken();
    const webhookUrl = `https://fattyvnmuezlaumtxbva.supabase.co/functions/v1/whatsapp-webhook?user_id=${user.id}`;
    
    setSettings(prev => ({
      ...prev,
      webhookUrl,
      verifyToken,
    }));
    setWebhookGenerated(true);

    // Save immediately
    try {
      await supabase
        .from('whatsapp_settings' as any)
        .upsert({
          user_id: user.id,
          api_token: settings.apiToken,
          phone_number_id: settings.phoneNumberId,
          business_account_id: settings.businessAccountId,
          webhook_url: webhookUrl,
          verify_token: verifyToken,
          is_connected: settings.isConnected,
        }, { onConflict: 'user_id' });

      toast({ title: 'Webhook generated! Copy the URL and verify token to Meta.' });
    } catch (error) {
      console.error('Error saving webhook:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.apiToken || !settings.phoneNumberId) {
      toast({ 
        title: 'Missing credentials', 
        description: 'Please enter API token and Phone Number ID',
        variant: 'destructive' 
      });
      return;
    }

    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'test_connection',
          token: settings.apiToken,
          phoneNumberId: settings.phoneNumberId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setSettings(prev => ({ ...prev, isConnected: true }));
        onConnectionChange?.(true);
        
        // Update database
        await supabase
          .from('whatsapp_settings' as any)
          .upsert({
            user_id: user?.id,
            api_token: settings.apiToken,
            phone_number_id: settings.phoneNumberId,
            business_account_id: settings.businessAccountId,
            webhook_url: settings.webhookUrl,
            verify_token: settings.verifyToken,
            is_connected: true,
          }, { onConflict: 'user_id' });

        toast({ 
          title: 'Connection successful!', 
          description: `Connected to ${data.phoneNumber || 'WhatsApp'}` 
        });
      } else {
        throw new Error(data?.error || 'Connection failed');
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setSettings(prev => ({ ...prev, isConnected: false }));
      onConnectionChange?.(false);
      toast({ 
        title: 'Connection failed', 
        description: error.message || 'Please check your credentials',
        variant: 'destructive' 
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncTemplates = async () => {
    if (!settings.apiToken || !settings.businessAccountId) {
      toast({ 
        title: 'Missing credentials', 
        description: 'Please enter API token and Business Account ID',
        variant: 'destructive' 
      });
      return;
    }

    setSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'sync_templates',
          token: settings.apiToken,
          businessAccountId: settings.businessAccountId,
          userId: user?.id,
        },
      });

      if (error) throw error;

      toast({ 
        title: 'Templates synced', 
        description: `${data?.count || 0} templates imported` 
      });
    } catch (error: any) {
      console.error('Template sync failed:', error);
      toast({ 
        title: 'Sync failed', 
        description: error.message || 'Failed to sync templates',
        variant: 'destructive' 
      });
    } finally {
      setSyncing(false);
    }
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
        <div className="flex items-center gap-3 p-4 bg-lotus-green/10 rounded-lg border border-lotus-green/20">
          <CheckCircle2 className="h-5 w-5 text-lotus-green" />
          <div>
            <p className="font-medium text-lotus-green">Connected to WhatsApp</p>
            <p className="text-sm text-muted-foreground">Your WhatsApp Business API is active</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                API Credentials
              </CardTitle>
              <CardDescription>
                Enter your WhatsApp Cloud API credentials from Meta Business Suite
              </CardDescription>
            </div>
            <Badge variant={settings.isConnected ? 'default' : 'secondary'}>
              {settings.isConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiToken">Access Token *</Label>
            <Input
              id="apiToken"
              type="password"
              value={settings.apiToken}
              onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
              placeholder="Enter your permanent access token"
            />
            <p className="text-xs text-muted-foreground">
              Get this from Meta Business Suite → WhatsApp → API Setup → Permanent Token
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId" className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" />
                Phone Number ID *
              </Label>
              <Input
                id="phoneNumberId"
                value={settings.phoneNumberId}
                onChange={(e) => setSettings({ ...settings, phoneNumberId: e.target.value })}
                placeholder="123456789012345"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessAccountId" className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Business Account ID
              </Label>
              <Input
                id="businessAccountId"
                value={settings.businessAccountId}
                onChange={(e) => setSettings({ ...settings, businessAccountId: e.target.value })}
                placeholder="987654321098765"
              />
              <p className="text-xs text-muted-foreground">Required for template sync</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Credentials
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={testing || !settings.apiToken || !settings.phoneNumberId}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Generate your unique webhook URL to receive messages from WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!webhookGenerated ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">
                After saving your credentials, generate a webhook URL to receive incoming messages
              </p>
              <Button 
                onClick={handleGenerateWebhook}
                disabled={!settings.apiToken || !settings.phoneNumberId}
              >
                <Link className="h-4 w-4 mr-2" />
                Generate Webhook URL
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={settings.webhookUrl}
                    readOnly
                    className="bg-muted font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(settings.webhookUrl, 'Webhook URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Verify Token</Label>
                <div className="flex gap-2">
                  <Input
                    value={settings.verifyToken}
                    readOnly
                    className="bg-muted font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(settings.verifyToken, 'Verify token')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Setup Instructions:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
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
          <CardTitle>Message Templates</CardTitle>
          <CardDescription>
            Sync your approved WhatsApp message templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            onClick={handleSyncTemplates}
            disabled={syncing || !settings.apiToken || !settings.businessAccountId || !settings.isConnected}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Templates
          </Button>
          {!settings.isConnected && (
            <p className="text-xs text-muted-foreground mt-2">
              Connect your API first to sync templates
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}