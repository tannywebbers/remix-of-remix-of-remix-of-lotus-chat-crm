import { Key, Palette, User, Bell, ChevronRight, ArrowLeft, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { WhatsAppApiSettings } from '@/components/settings/WhatsAppApiSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { WhatsAppBusinessProfile } from '@/components/settings/WhatsAppBusinessProfile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    if (user) checkConnectionStatus();
  }, [user]);

  const checkConnectionStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('whatsapp_settings')
        .select('is_connected')
        .eq('user_id', user.id)
        .maybeSingle();
      setIsConnected(data?.is_connected || false);
    } catch {}
  };

  // Show settings sub-page with back nav
  if (activeTab) {
    const currentTab = settingsTabs.find(t => t.id === activeTab);
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Sub-page header */}
        <div className="flex items-center gap-1 px-2 pt-2 pb-1 bg-panel shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setActiveTab(null)} className="h-9 w-9 text-primary">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-[17px] font-semibold">{currentTab?.label}</h1>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4">
            {activeTab === 'business' && <WhatsAppBusinessProfile />}
            {activeTab === 'api' && <WhatsAppApiSettings onConnectionChange={setIsConnected} />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'theme' && <ThemeSettings />}
            {activeTab === 'account' && <AccountSettings />}
          </div>
        </div>
      </div>
    );
  }

  // Settings list - scrollable, no extra header since MobileLayout shows "Settings" via ChatList
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Title for settings list */}
      <div className="px-4 pt-3 pb-1 bg-panel shrink-0">
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-card mt-2">
          {settingsTabs.map(({ id, label, icon: Icon, description, showBadge }, index) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="w-full flex items-center gap-4 px-4 py-[14px] hover:bg-accent/50 transition-colors active:bg-accent/70"
            >
              <div className="h-[38px] w-[38px] rounded-[10px] bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-[20px] w-[20px] text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0 border-b border-panel-border pb-[14px]">
                <div className="flex items-center gap-2">
                  <p className="text-[17px] font-medium">{label}</p>
                  {showBadge && (
                    <Badge 
                      variant={isConnected ? 'default' : 'secondary'}
                      className="text-[10px] px-1.5 py-0 h-[18px]"
                    >
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </Badge>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground">{description}</p>
              </div>
              <ChevronRight className="h-[18px] w-[18px] text-muted-foreground/50 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
