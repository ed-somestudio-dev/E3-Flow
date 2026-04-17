import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { toast } from 'sonner';

export interface PixSettingsRow {
  pixKey: string;
  pixKeyType: string;
  beneficiaryName: string;
  beneficiaryCity: string;
  beneficiaryDocument: string;
}

const empty: PixSettingsRow = {
  pixKey: '', pixKeyType: 'cpf', beneficiaryName: '',
  beneficiaryCity: '', beneficiaryDocument: '',
};

interface Ctx {
  settings: PixSettingsRow;
  loaded: boolean;
  isConfigured: boolean;
  save: (s: PixSettingsRow) => Promise<void>;
}

const PixSettingsContext = createContext<Ctx | null>(null);

export function PixSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PixSettingsRow>(empty);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setSettings(empty); setLoaded(true); return; }
    (async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) console.error(error);
      if (data) {
        setSettings({
          pixKey: data.pix_key || '',
          pixKeyType: data.pix_key_type || 'cpf',
          beneficiaryName: data.beneficiary_name || '',
          beneficiaryCity: data.beneficiary_city || '',
          beneficiaryDocument: data.beneficiary_document || '',
        });
      }
      setLoaded(true);
    })();
  }, [user]);

  const save = useCallback(async (s: PixSettingsRow) => {
    if (!user) return;
    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      pix_key: s.pixKey || null,
      pix_key_type: s.pixKeyType || null,
      beneficiary_name: s.beneficiaryName || null,
      beneficiary_city: s.beneficiaryCity || null,
      beneficiary_document: s.beneficiaryDocument || null,
    }, { onConflict: 'user_id' });
    if (error) { toast.error('Erro ao salvar: ' + error.message); throw error; }
    setSettings(s);
    toast.success('Configurações PIX salvas');
  }, [user]);

  const isConfigured = !!(settings.pixKey && settings.beneficiaryName && settings.beneficiaryCity);

  return (
    <PixSettingsContext.Provider value={{ settings, loaded, isConfigured, save }}>
      {children}
    </PixSettingsContext.Provider>
  );
}

export function usePixSettings() {
  const ctx = useContext(PixSettingsContext);
  if (!ctx) throw new Error('usePixSettings must be used inside PixSettingsProvider');
  return ctx;
}
