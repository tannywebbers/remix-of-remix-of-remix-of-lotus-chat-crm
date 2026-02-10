import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/appStore';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { MobileLayout } from '@/components/layout/MobileLayout';

const Index = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { loadData, loading, contacts } = useAppStore();

  // Apply persisted theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('app_theme') || 'light';
    const isDark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    if (user) {
      loadData(user.id);
    }
  }, [user, loadData]);

  // Show loading only if no cached data
  if (loading && contacts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  return isMobile ? <MobileLayout /> : <DesktopLayout />;
};

export default Index;