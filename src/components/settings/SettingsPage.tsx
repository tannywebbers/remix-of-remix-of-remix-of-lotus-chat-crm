import { Key, Palette, User, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ApiSettings } from '@/components/settings/ApiSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { cn } from '@/lib/utils';
import { SettingsTab } from '@/types';

const settingsTabs: { id: SettingsTab; label: string; icon: typeof Key; description: string }[] = [
  { id: 'api', label: 'WhatsApp API', icon: Key, description: 'Configure WhatsApp Cloud API' },
  { id: 'theme', label: 'Appearance', icon: Palette, description: 'Theme and colors' },
  { id: 'account', label: 'Account', icon: User, description: 'Profile and security' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');

  return (
    <div className="min-h-full bg-background">
      {/* Settings Navigation */}
      <div className="divide-y divide-panel-border bg-card">
        {settingsTabs.map(({ id, label, icon: Icon, description }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors',
              activeTab === id && 'bg-accent'
            )}
          >
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
              activeTab === id ? 'bg-primary/20' : 'bg-muted'
            )}>
              <Icon className={cn('h-5 w-5', activeTab === id ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium">{label}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className={cn('h-5 w-5', activeTab === id ? 'text-primary' : 'text-muted-foreground')} />
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <div className="p-4">
        {activeTab === 'api' && <ApiSettings />}
        {activeTab === 'theme' && <ThemeSettings />}
        {activeTab === 'account' && <AccountSettings />}
      </div>
    </div>
  );
}
