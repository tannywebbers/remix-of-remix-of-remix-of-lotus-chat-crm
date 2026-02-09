import { Key, Palette, User, Bell, ChevronRight, ArrowLeft, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { WhatsAppApiSettings } from '@/components/settings/WhatsAppApiSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { WhatsAppBusinessProfile } from '@/components/settings/WhatsAppBusinessProfile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type SettingsTab = 'api' | 'theme' | 'account' | 'notifications' | 'business';

interface SettingsItem {
  id: SettingsTab;
  label: string;
  icon: typeof Key;
  description: string;
  showBadge?: boolean;
}

const settingsTabs: SettingsItem[] = [
  { id: 'business', label: 'Business Profile', icon: Building2, description: 'WhatsApp Business info' },
  { id: 'api', label: 'WhatsApp API', icon: Key, description: 'Configure Cloud API', showBadge: true },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Message alerts and sounds' },
  { id: 'theme', label: 'Appearance', icon: Palette, description: 'Theme and colors' },
  { id: 'account', label: 'Account', icon: User, description: 'Profile and security' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      checkConnectionStatus();
    }
  }, [user]);

  const checkConnectionStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('whatsapp_settings' as any)
        .select('is_connected')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsConnected((data as any)?.is_connected || false);
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  // Show settings list
  if (!activeTab) {
    return (
      <ScrollArea className="h-full">
        <div className="min-h-full bg-background">
          <div className="divide-y divide-panel-border bg-card">
            {settingsTabs.map(({ id, label, icon: Icon, description, showBadge }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors active:bg-accent/70"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{label}</p>
                    {showBadge && (
                      <Badge 
                        variant={isConnected ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {isConnected ? 'Connected' : 'Not Connected'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    );
  }

  // Show specific setting page
  const currentTab = settingsTabs.find(t => t.id === activeTab);

  return (
    <div className="min-h-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-panel-header border-b border-panel-border shrink-0">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setActiveTab(null)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{currentTab?.label}</h1>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeTab === 'business' && <WhatsAppBusinessProfile />}
          {activeTab === 'api' && <WhatsAppApiSettings onConnectionChange={setIsConnected} />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'theme' && <ThemeSettings />}
          {activeTab === 'account' && <AccountSettings />}
        </div>
      </ScrollArea>
    </div>
  );
}