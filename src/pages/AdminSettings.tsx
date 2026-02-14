import { useState } from 'react';
import { Lock, Palette, Type, Bell, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const ADMIN_PASSWORD = 'lotus_admin_2026';

export default function AdminSettings() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const { toast } = useToast();

  const [appName, setAppName] = useState(() => localStorage.getItem('admin_app_name') || 'Lotus CRM');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('admin_primary_color') || '#25D366');
  const [notificationSound, setNotificationSound] = useState(() => localStorage.getItem('admin_notification_sound') || 'default');

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Admin Access</CardTitle>
            <p className="text-sm text-muted-foreground">Enter admin password to continue</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (password === ADMIN_PASSWORD) {
                setAuthenticated(true);
              } else {
                toast({ title: 'Access denied', description: 'Incorrect password', variant: 'destructive' });
              }
            }} className="space-y-4">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full">Unlock</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = () => {
    localStorage.setItem('admin_app_name', appName);
    localStorage.setItem('admin_primary_color', primaryColor);
    localStorage.setItem('admin_notification_sound', notificationSound);
    toast({ title: 'Settings saved', description: 'Changes applied. Reload to see full effect.' });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Admin Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Type className="h-5 w-5" /> Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>App Name</Label>
              <Input value={appName} onChange={e => setAppName(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Theme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer" />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-32" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sound</Label>
              <select 
                value={notificationSound} 
                onChange={e => setNotificationSound(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="default">Default beep</option>
                <option value="iphone">iPhone SMS tone</option>
                <option value="whatsapp">WhatsApp tone</option>
                <option value="none">Silent</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} className="w-full" size="lg">Save Settings</Button>
      </div>
    </div>
  );
}
