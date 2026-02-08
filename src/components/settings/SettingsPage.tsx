import { Key, Palette, User, ChevronRight, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { WhatsAppApiSettings } from '@/components/settings/WhatsAppApiSettings';
import { ThemeSettings } from '@/components/settings/ThemeSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SettingsTab } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

const settingsTabs: { id: SettingsTab; label: string; icon: typeof Key; description: string }[] = [
  { id: 'api', label: 'WhatsApp API', icon: Key, description: 'Configure WhatsApp Cloud API' },
  { id: 'theme', label: 'Appearance', icon: Palette, description: 'Theme and colors' },
  { id: 'account', label: 'Account', icon: User, description: 'Profile and security' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab | null>(null);

  // Show settings list
  if (!activeTab) {
    return (
      <div className="min-h-full bg-background">
        <div className="divide-y divide-panel-border bg-card">
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
          {activeTab === 'api' && <WhatsAppApiSettings />}
          {activeTab === 'theme' && <ThemeSettings />}
          {activeTab === 'account' && <AccountSettings />}
        </div>
      </ScrollArea>
    </div>
  );
}
