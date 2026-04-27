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
  receiptStampUrl: string;
  remindersEnabled: boolean;
  reminderDaysBefore: number;
}

const empty: PixSettingsRow = {
  pixKey: '', pixKeyType: 'cpf', beneficiaryName: '',
  beneficiaryCity: '', beneficiaryDocument: '', receiptStampUrl: '',
  remindersEnabled: true, reminderDaysBefore: 3,
};

interface Ctx {
  settings: PixSettingsRow;
  loaded: boolean;
  isConfigured: boolean;
  save: (s: PixSettingsRow) => Promise<void>;
  uploadStamp: (file: File) => Promise<string>;
  removeStamp: () => Promise<void>;
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
          receiptStampUrl: (data as any).receipt_stamp_url || '',
          remindersEnabled: (data as any).reminders_enabled ?? true,
          reminderDaysBefore: (data as any).reminder_days_before ?? 3,
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
      receipt_stamp_url: s.receiptStampUrl || null,
      reminders_enabled: s.remindersEnabled,
      reminder_days_before: s.reminderDaysBefore,
    } as any, { onConflict: 'user_id' });
    if (error) { toast.error('Erro ao salvar: ' + error.message); throw error; }
    setSettings(s);
    toast.success('Configurações salvas');
  }, [user]);

  const uploadStamp = useCallback(async (file: File): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    if (file.size > 2 * 1024 * 1024) throw new Error('Imagem deve ter no máximo 2MB');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${user.id}/stamp-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('receipt-stamps').upload(path, file, {
      cacheControl: '3600', upsert: true, contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('receipt-stamps').getPublicUrl(path);
    const url = data.publicUrl;
    await save({ ...settings, receiptStampUrl: url });
    return url;
  }, [user, settings, save]);

  const removeStamp = useCallback(async () => {
    if (!user) return;
    await save({ ...settings, receiptStampUrl: '' });
  }, [user, settings, save]);

  const isConfigured = !!(settings.pixKey && settings.beneficiaryName && settings.beneficiaryCity);

  return (
    <PixSettingsContext.Provider value={{ settings, loaded, isConfigured, save, uploadStamp, removeStamp }}>
      {children}
    </PixSettingsContext.Provider>
  );
}

export function usePixSettings() {
  const ctx = useContext(PixSettingsContext);
  if (!ctx) throw new Error('usePixSettings must be used inside PixSettingsProvider');
  return ctx;
}
