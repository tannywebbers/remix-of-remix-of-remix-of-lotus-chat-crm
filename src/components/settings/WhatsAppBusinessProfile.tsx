import { useState, useEffect } from 'react';
import { Building2, Globe, Mail, MapPin, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface BusinessProfile {
  name: string;
  description?: string;
  address?: string;
  email?: string;
  website?: string;
  vertical?: string;
  profilePictureUrl?: string;
}

export function WhatsAppBusinessProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: settings } = await supabase
        .from('whatsapp_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settings && (settings as any).is_connected) {
        setIsConnected(true);
        
        // Fetch business profile from WhatsApp API
        const { data, error } = await supabase.functions.invoke('whatsapp-api', {
          body: {
            action: 'get_business_profile',
            token: (settings as any).api_token,
            phoneNumberId: (settings as any).phone_number_id,
          },
        });

        if (data?.success && data.profile) {
          setProfile(data.profile);
          setPhoneNumber(data.phoneNumber || '');
        }
      }
    } catch (error) {
      console.error('Error loading business profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Not Connected</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Connect your WhatsApp Business Account to view your business profile. 
            Go to WhatsApp API settings to configure.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <ContactAvatar 
              name={profile?.name || 'Business'} 
              avatar={profile?.profilePictureUrl}
              size="lg"
            />
            <div className="flex-1">
              <CardTitle className="text-xl">{profile?.name || 'Your Business'}</CardTitle>
              {phoneNumber && (
                <CardDescription className="text-base mt-1">
                  {phoneNumber}
                </CardDescription>
              )}
            </div>
            <Badge variant="default" className="bg-lotus-green">
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">About</p>
              <p className="text-sm">{profile.description}</p>
            </div>
          )}

          {profile?.vertical && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{profile.vertical}</span>
            </div>
          )}

          {profile?.address && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{profile.address}</span>
            </div>
          )}

          {profile?.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{profile.email}</span>
            </div>
          )}

          {profile?.website && (
            <div className="flex items-center gap-3 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <a 
                href={profile.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {profile.website}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Business Hours
          </CardTitle>
          <CardDescription>
            Your WhatsApp Business hours as configured in Meta Business Suite
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Business hours are configured in your Meta Business Suite. 
            Visit the Meta dashboard to update your availability.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}