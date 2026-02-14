import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useMessageNotifications } from '@/hooks/useMessageNotifications';
import { usePresenceRefresh } from '@/hooks/usePresenceRefresh';
import { pushNotificationManager } from '@/lib/pushNotificationManager';
import { lazy, Suspense, useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const AdminSettings = lazy(() => import("./pages/AdminSettings"));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// UPDATED: AppRoutes with all hooks integrated
function AppRoutes() {
  const { user } = useAuth();

  // 🔔 Desktop/Local Notifications
  useMessageNotifications();

  // 🟢 Auto-refresh online status every 30s
  usePresenceRefresh();

  // 📲 Initialize Push Notifications (for mobile)
  useEffect(() => {
    if (user && pushNotificationManager.isSupported()) {
      // Check if already subscribed
      pushNotificationManager.isSubscribed().then(subscribed => {
        if (!subscribed) {
          // Initialize push in background
          pushNotificationManager.initialize(user.id).then(result => {
            if (result.success) {
              console.log('✅ Push notifications initialized');
            } else {
              console.log('ℹ️ Push not available:', result.error);
            }
          });
        } else {
          console.log('✅ Already subscribed to push');
        }
      });
    }
  }, [user]);

  return (
    <Routes>
      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route 
        path="/app/settings" 
        element={
          <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          }>
            <ProtectedRoute>
              <AdminSettings />
            </ProtectedRoute>
          </Suspense>
        } 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
