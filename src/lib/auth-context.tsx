import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { migrateGuestData } from './offline-store';
import { assertOnline } from './online-guard';
import { toast } from 'sonner';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  tenantUserId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tenantUserId, setTenantUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenantId = async (userEmail: string | undefined, userId: string) => {
    if (!userEmail) return userId;
    try {
      const { data, error } = await supabase
        .from('family_members')
        .select('owner_id')
        .eq('member_email', userEmail)
        .maybeSingle();
      if (!error && data?.owner_id) {
        return data.owner_id;
      }
    } catch (e) {
      console.warn('Erro ao buscar tenant', e);
    }
    return userId;
  };

  useEffect(() => {
    let isMounted = true;
    const fetchTenant = async () => {
      if (session?.user && !session.user.id.startsWith('guest_')) {
        const tId = await fetchTenantId(session.user.email, session.user.id);
        if (isMounted) setTenantUserId(tId);
      } else if (session?.user?.id?.startsWith('guest_')) {
        if (isMounted) setTenantUserId(session.user.id);
      } else {
        if (isMounted) setTenantUserId(null);
      }
    };
    fetchTenant();
    return () => { isMounted = false; };
  }, [session?.user]);

  useEffect(() => {
    // Standard auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      
      // If we just logged in and had a guest session, migrate data
      if (session?.user && !session.user.id.startsWith('guest_')) {
        localStorage.setItem('fluxopro_offline_user', JSON.stringify({
          user: session.user,
          timestamp: Date.now()
        }));
        
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
      let finalSession: Session | null = null;
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 3000));
        
        let initialSession: Session | null = null;
        try {
          const result = await Promise.race([
            supabase.auth.getSession(),
            timeoutPromise as any
          ]);
          initialSession = result?.data?.session || null;
        } catch (e) {
          console.warn('[AuthContext] Timeout ou erro ao obter sessão do Supabase:', e);
        }
        
        if (initialSession) {
          const isGuest = initialSession.user?.id?.startsWith('guest_');
          
          // Verify session is still valid only if we are online and not a guest
          if (!isGuest && assertOnline()) {
            try {
              const { error } = await Promise.race([
                supabase.auth.getUser(),
                timeoutPromise as any
              ]);
              if (error && (error.status === 401 || error.message.includes('expired'))) {
                 console.warn('[AuthContext] Sessão expirada detectada na inicialização.');
                 await supabase.auth.signOut();
                 initialSession = null;
              }
            } catch (e) {
              console.warn('[AuthContext] Timeout ou erro na verificação online da sessão. Assumindo modo offline.');
            }
          }
        }

        if (initialSession) {
          finalSession = initialSession;
        }
      } catch (err) {
        console.error('[AuthContext] Erro crítico ao recuperar sessão:', err);
      } finally {
        if (!finalSession) {
          // Check 24-hour offline fallback first
          const offlineDataStr = localStorage.getItem('fluxopro_offline_user');
          if (offlineDataStr && !assertOnline()) {
             try {
               const offlineData = JSON.parse(offlineDataStr);
               const isWithin24Hours = (Date.now() - offlineData.timestamp) < 24 * 60 * 60 * 1000;
               if (isWithin24Hours) {
                 console.log('[AuthContext] Usando fallback offline de 24h para o usuário:', offlineData.user.email);
                 finalSession = {
                   user: offlineData.user,
                   access_token: 'offline_token',
                   refresh_token: 'offline_token',
                   expires_in: 86400,
                   token_type: 'bearer'
                 } as Session;
               } else {
                 console.warn('[AuthContext] Fallback offline expirou (mais de 24h).');
               }
             } catch(e) { console.error('Erro no fallback offline', e); }
          }
          
          // Otherwise check for guest session in localStorage
          if (!finalSession) {
            const guestId = localStorage.getItem('fluxopro_guest_id');
            if (guestId) {
              finalSession = {
                user: { id: guestId, email: 'visitante@fluxopro.local', user_metadata: { name: 'Visitante' } } as any,
                access_token: 'guest',
                refresh_token: 'guest',
                expires_in: 3600,
                token_type: 'bearer'
              } as Session;
            }
          }
        }
        
        setSession(finalSession);
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
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
          } catch (e) {
            // Ignorar se o browser não estiver aberto
          }

          const url = new URL(data.url);
          
          // O Supabase v2 usa PKCE por padrão (?code=...)
          const code = url.searchParams.get('code');
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
            return;
          }

          // Fallback para Implicit Flow (#access_token=...)
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
    localStorage.removeItem('fluxopro_offline_user');
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, tenantUserId, loading, signOut, signInAsGuest } as any}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
