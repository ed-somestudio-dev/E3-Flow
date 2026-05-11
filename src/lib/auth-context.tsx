import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { migrateGuestData } from './offline-store';
import { toast } from 'sonner';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Standard auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      
      // If we just logged in and had a guest session, migrate data
      if (session?.user && !session.user.id.startsWith('guest_')) {
        const guestId = localStorage.getItem('fluxopro_guest_id');
        if (guestId && guestId !== session.user.id) {
          console.log('[AuthContext] Sessão real detectada. Migrando dados do visitante...');
          await migrateGuestData(guestId, session.user.id);
          localStorage.removeItem('fluxopro_guest_id');
          toast.success('Dados sincronizados com sua conta!');
        }
      }
      
      setLoading(false);
    });

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          // Verify session is still valid by doing a lightweight user check
          const { error } = await supabase.auth.getUser();
          if (error && (error.status === 401 || error.message.includes('expired'))) {
             console.warn('[AuthContext] Sessão expirada detectada na inicialização.');
             await supabase.auth.signOut();
             setSession(null);
          } else {
             setSession(initialSession);
          }
        } else {
          // Check for guest session in localStorage
          const guestId = localStorage.getItem('fluxopro_guest_id');
          if (guestId) {
            setSession({
              user: { id: guestId, email: 'visitante@fluxopro.local', user_metadata: { name: 'Visitante' } } as any,
              access_token: 'guest',
              refresh_token: 'guest',
              expires_in: 3600,
              token_type: 'bearer'
            } as Session);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Erro ao recuperar sessão:', err);
      } finally {
        setLoading(false);
      }
    };
    getInitialSession();

    // Handle Deep Linking for Mobile (Google Login / Email Confirmation)
    const handleDeepLink = async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { App } = await import('@capacitor/app');
        App.addListener('appUrlOpen', async (data) => {
          const url = new URL(data.url);
          // Supabase uses fragment (#) for tokens in OAuth/Email flows
          const hash = url.hash.substring(1);
          if (hash) {
            const params = new URLSearchParams(hash);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          }
        });
      }
    };
    handleDeepLink();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInAsGuest = () => {
    const guestId = 'guest_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('fluxopro_guest_id', guestId);
    setSession({
      user: { id: guestId, email: 'visitante@fluxopro.local', user_metadata: { name: 'Visitante' } } as any,
      access_token: 'guest',
      refresh_token: 'guest',
      expires_in: 3600,
      token_type: 'bearer'
    } as Session);
  };

  const signOut = async () => {
    localStorage.removeItem('fluxopro_guest_id');
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut, signInAsGuest } as any}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
