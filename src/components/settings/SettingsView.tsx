import { Key, Palette, User, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ApiSettings } from '@/components/settings/ApiSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { cn } from '@/lib/utils';
import { SettingsTab } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

const settingsTabs: { id: SettingsTab; label: string; icon: typeof Key; description: string }[] = [
  { id: 'api', label: 'WhatsApp API', icon: Key, description: 'Configure WhatsApp Cloud API' },
  { id: 'theme', label: 'Appearance', icon: Palette, description: 'Theme and colors' },
  { id: 'account', label: 'Account', icon: User, description: 'Profile and security' },
];

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar">
        <div className="divide-y divide-panel-border">
          {settingsTabs.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Settings Sidebar */}
      <div className="w-64 border-r border-panel-border bg-panel-header/50">
        <div className="p-4">
          <h2 className="font-semibold text-lg">Settings</h2>
        </div>
        <nav className="space-y-1 px-2">
          {settingsTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                activeTab === id 
                  ? 'bg-accent text-primary' 
                  : 'hover:bg-accent/50 text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="max-w-2xl">
          {activeTab === 'api' && <ApiSettings />}
          {activeTab === 'theme' && <ThemeSettings />}
          {activeTab === 'account' && <AccountSettings />}
        </div>
      </div>
    </div>
  );
}
