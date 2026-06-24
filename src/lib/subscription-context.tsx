import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { toast } from 'sonner';

export type SubscriptionStatus = 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'CANCELLED' | 'INACTIVE' | 'TRIAL';

export interface Subscription {
  id: string;
  user_id: string;
  asaas_customer_id: string;
  asaas_subscription_id: string;
  subscription_status: SubscriptionStatus;
  subscription_due_date: string;
  subscription_plan: string;
  subscription_cycle?: 'MONTHLY' | 'YEARLY' | 'QUARTERLY' | null;
  trial_end_date?: string | null;
  created_at: string;
  updated_at: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  loading: boolean;
  isActive: boolean;
  isInTrial: boolean;
  trialDaysRemaining: number | null;
  daysUntilDue: number | null;
  isAdmin: boolean;
  createSubscription: (plan: 'monthly' | 'yearly', customerData: {
    name: string;
    cpfCnpj: string;
    phone?: string;
  }) => Promise<{ invoiceUrl?: string }>;
  updateSubscription: (plan: 'monthly' | 'yearly') => Promise<void>;
  cancelSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export const TRIAL_DAYS = 14;

export const PLANS = {
  monthly: {
    name: 'Mensal',
    value: 7.90,
    planId: 'monthly',
    cycle: 'MONTHLY' as const,
  },
  yearly: {
    name: 'Anual',
    value: 59.90,
    planId: 'yearly',
    cycle: 'YEARLY' as const,
  },
};

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminState, setIsAdmin] = useState(false);

  // Edson dos Santos Oliveira bypass (owner/developer)
  const isDeveloperBypass = Boolean(
    user && user.email && (
      user.email.toLowerCase() === 'ed-somestudio@live.com' ||
      user.email.toLowerCase() === 'contato@fluxopro.app.br'
    )
  );

  useEffect(() => {
    if (user) {
      console.log('[SubscriptionProvider] User check:', {
        email: user.email,
        metadata: user.user_metadata,
        isDeveloperBypass
      });
    }
  }, [user, isDeveloperBypass]);

  const isAdmin = isDeveloperBypass || isAdminState;

  const effectiveSubscription = isDeveloperBypass 
    ? subscription || {
        id: 'bypass-sub-id',
        user_id: user?.id || 'bypass-user-id',
        asaas_customer_id: 'bypass',
        asaas_subscription_id: 'bypass',
        subscription_status: 'CONFIRMED' as const,
        subscription_plan: 'yearly',
        subscription_due_date: '2099-12-31',
        trial_end_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Subscription
    : subscription;

  const fetchSubscription = useCallback(async () => {
    if (!user || user.id.startsWith('guest_')) {
      setSubscription(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // The auto_provision_trial RPC function will:
      // 1. Return the existing subscription if it exists and is active
      // 2. Upgrade PENDING subscriptions to TRIAL
      // 3. Create a new TRIAL subscription if none exists
      const { data: newSub, error: rpcError } = await supabase
        .rpc('auto_provision_trial' as any);

      if (!rpcError && newSub) {
        setSubscription({
          ...(newSub as unknown as Subscription),
          trial_end_date: (newSub as any).trial_end_date ?? null,
        });
      } else {
        console.warn('[SubscriptionProvider] Falha ao executar auto_provision_trial:', rpcError);
        // Fallback: tentar buscar a assinatura normalmente se a RPC falhar
        const { data } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data) {
          setSubscription({
            ...(data as Subscription),
            trial_end_date: (data as any).trial_end_date ?? null,
          });
        } else {
          setSubscription(null);
        }
      }

      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleData && roleData.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (roleErr) {
        console.warn('[SubscriptionProvider] Tabela user_roles não disponível:', roleErr);
        setIsAdmin(false);
      }
    } catch (err) {
      console.error('[SubscriptionProvider] Erro inesperado:', err);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();

    if (user) {
      const channel = supabase.channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` },
          (payload) => {
            if (payload.new) {
              setSubscription(payload.new as Subscription);
            }
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchSubscription, user]);

  const createSubscription = useCallback(async (
    plan: 'monthly' | 'yearly',
    customerData: { name: string; cpfCnpj: string; phone?: string }
  ): Promise<{ invoiceUrl?: string }> => {
    if (!user || !user.email) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const planConfig = PLANS[plan as keyof typeof PLANS] || PLANS.monthly;
      
      let trialDaysToPass = TRIAL_DAYS;
      let trialEndDateStr: string | undefined = undefined;

      if (effectiveSubscription?.trial_end_date) {
        const remaining = Math.ceil((new Date(effectiveSubscription.trial_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (remaining > 0) {
          trialDaysToPass = remaining;
          trialEndDateStr = new Date(effectiveSubscription.trial_end_date).toISOString().split('T')[0];
        } else {
          trialDaysToPass = 0;
          trialEndDateStr = new Date().toISOString().split('T')[0]; // cobrar hoje
        }
      } else {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);
        trialEndDateStr = trialEndDate.toISOString().split('T')[0];
      }

      const { data, error } = await supabase.functions.invoke('asaas-checkout', {
        body: {
          planId: planConfig.planId,
          trialDays: trialDaysToPass,
          trialEndDate: trialEndDateStr,
          userName: customerData.name,
          userEmail: user.email,
          userCpfCnpj: customerData.cpfCnpj
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao comunicar com o servidor');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      await fetchSubscription();

      return {
        invoiceUrl: data?.invoiceUrl,
      };
    } catch (err: any) {
      console.error('[SubscriptionProvider] Erro ao criar assinatura:', err);
      toast.error(err.message || 'Erro ao criar assinatura');
      throw err;
    }
  }, [user, fetchSubscription]);

  const updateSubscription = useCallback(async (plan: 'monthly' | 'yearly') => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const { data, error } = await supabase.functions.invoke('asaas-update-subscription', {
        body: { planId: plan }
      });
      if (error) throw new Error(error.message || 'Erro ao comunicar com o servidor');
      if (data?.error) throw new Error(data.error);
      
      await fetchSubscription();
    } catch (err: any) {
      console.error('[SubscriptionProvider] Erro ao atualizar assinatura:', err);
      throw err;
    }
  }, [user, fetchSubscription]);

  const cancelSubscription = useCallback(async () => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const { data, error } = await supabase.functions.invoke('asaas-cancel-subscription');
      if (error) throw new Error(error.message || 'Erro ao comunicar com o servidor');
      if (data?.error) throw new Error(data.error);
      
      toast.success('Assinatura cancelada com sucesso!');
      await fetchSubscription();
    } catch (err: any) {
      console.error('[SubscriptionProvider] Erro ao cancelar assinatura:', err);
      toast.error(err.message || 'Erro ao cancelar assinatura');
      throw err;
    }
  }, [user, fetchSubscription]);

  const registrationDate = user?.created_at ? new Date(user.created_at) : null;
  const defaultTrialEndDate = registrationDate 
    ? new Date(registrationDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    : null;
  
  const isDefaultTrialActive = !subscription && defaultTrialEndDate && defaultTrialEndDate.getTime() > new Date().getTime();

  const daysUntilDue = effectiveSubscription?.subscription_due_date
    ? Math.ceil((new Date(effectiveSubscription.subscription_due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let trialDaysRemaining = effectiveSubscription?.trial_end_date
    ? Math.max(0, Math.ceil((new Date(effectiveSubscription.trial_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : (isDefaultTrialActive && defaultTrialEndDate ? Math.max(0, Math.ceil((defaultTrialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : null);

  let isPaidStatus = effectiveSubscription?.subscription_status === 'RECEIVED' || effectiveSubscription?.subscription_status === 'CONFIRMED';

  let isInTrial = Boolean(
    !isPaidStatus &&
    ((effectiveSubscription?.trial_end_date && new Date(effectiveSubscription.trial_end_date).getTime() > new Date().getTime())
    || isDefaultTrialActive)
  );

  let isActive = isDeveloperBypass
    || isPaidStatus
    || isInTrial;


  return (
    <SubscriptionContext.Provider value={{
      subscription: effectiveSubscription,
      loading,
      isActive,
      isInTrial,
      trialDaysRemaining,
      daysUntilDue,
      isAdmin,
      createSubscription,
      updateSubscription,
      cancelSubscription,
      refreshSubscription: fetchSubscription,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
