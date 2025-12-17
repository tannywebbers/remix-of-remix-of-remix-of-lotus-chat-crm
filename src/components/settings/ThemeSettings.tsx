import { useState } from 'react';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const themes = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

const accentColors = [
  { id: 'teal', color: 'bg-[hsl(168,76%,42%)]', label: 'Teal' },
  { id: 'green', color: 'bg-[hsl(142,70%,45%)]', label: 'Green' },
  { id: 'blue', color: 'bg-[hsl(199,89%,48%)]', label: 'Blue' },
  { id: 'purple', color: 'bg-[hsl(262,83%,58%)]', label: 'Purple' },
  { id: 'orange', color: 'bg-[hsl(25,95%,53%)]', label: 'Orange' },
];

export function ThemeSettings() {
  const [theme, setTheme] = useState('light');
  const [accentColor, setAccentColor] = useState('teal');

  const handleThemeChange = (value: string) => {
    setTheme(value);
    // Would apply theme in real implementation
    if (value === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (value === 'light') {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how Lotus looks on your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base">Theme</Label>
            <RadioGroup 
              value={theme} 
              onValueChange={handleThemeChange}
              className="grid grid-cols-3 gap-3"
            >
              {themes.map(({ id, label, icon: Icon }) => (
                <Label
                  key={id}
                  htmlFor={id}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors',
                    theme === id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem value={id} id={id} className="sr-only" />
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{label}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Accent Color
          </CardTitle>
          <CardDescription>
            Choose your preferred accent color for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {accentColors.map(({ id, color, label }) => (
              <button
                key={id}
                onClick={() => setAccentColor(id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors',
                  accentColor === id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div className={cn('h-8 w-8 rounded-full', color)} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
