import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { toast } from 'sonner';
import { assertOnline } from './online-guard';
import { enqueueMutation, saveSnapshot, loadSnapshot } from './offline-store';
import { Preferences } from '@capacitor/preferences';

export interface PixSettingsRow {
  pixKey: string;
  pixKeyType: string;
  beneficiaryName: string;
  beneficiaryCity: string;
  beneficiaryDocument: string;
  receiptStampUrl: string;
  remindersEnabled: boolean;
  reminderDaysBefore: number;
  salesModuleEnabled: boolean;
}

const empty: PixSettingsRow = {
  pixKey: '', pixKeyType: 'cpf', beneficiaryName: '',
  beneficiaryCity: '', beneficiaryDocument: '', receiptStampUrl: '',
  remindersEnabled: true, reminderDaysBefore: 3, salesModuleEnabled: false,
};

interface Ctx {
  settings: PixSettingsRow;
  loaded: boolean;
  isConfigured: boolean;
  save: (s: PixSettingsRow) => Promise<void>;
  uploadStamp: (file: File) => Promise<string>;
  removeStamp: () => Promise<void>;
  refresh: () => Promise<void>;
  uploadStampFromBase64: (base64: string) => Promise<string>;
}

const PixSettingsContext = createContext<Ctx | null>(null);

export function PixSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PixSettingsRow>(empty);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setSettings(empty); setLoaded(true); return; }
    
    const isOnline = assertOnline() && !user.id.startsWith('guest_');

    if (isOnline) {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) console.error(error);
      if (data) {
        const newSettings = {
          pixKey: data.pix_key || '',
          pixKeyType: data.pix_key_type || 'cpf',
          beneficiaryName: data.beneficiary_name || '',
          beneficiaryCity: data.beneficiary_city || '',
          beneficiaryDocument: data.beneficiary_document || '',
          receiptStampUrl: (data as any).receipt_stamp_url || '',
          remindersEnabled: (data as any).reminders_enabled ?? true,
          reminderDaysBefore: (data as any).reminder_days_before ?? 3,
          salesModuleEnabled: (data as any).sales_module_enabled ?? false,
        };
        setSettings(newSettings);
        await Preferences.set({ key: `pix_settings_${user.id}`, value: JSON.stringify(newSettings) });
        
        // Cache da imagem da assinatura para funcionar offline
        if (newSettings.receiptStampUrl) {
          try {
            const res = await fetch(newSettings.receiptStampUrl);
            const blob = await res.blob();
            const reader = new FileReader();
            reader.onloadend = async () => {
              await Preferences.set({ key: `stamp_cache_${newSettings.receiptStampUrl}`, value: reader.result as string });
            };
            reader.readAsDataURL(blob);
          } catch (e) {
            console.warn('Falha ao armazenar cache da assinatura offline', e);
          }
        }
      } else {
        setSettings(empty);
        if (!error) await Preferences.set({ key: `pix_settings_${user.id}`, value: JSON.stringify(empty) });
      }
    } else {
      const { value } = await Preferences.get({ key: `pix_settings_${user.id}` });
      if (value) {
        try { setSettings(JSON.parse(value)); } catch (e) { setSettings(empty); }
      } else {
        setSettings(empty);
      }
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [user, refresh]);

  const save = useCallback(async (s: PixSettingsRow) => {
    if (!user) return;
    const isOnline = assertOnline() && !user.id.startsWith('guest_');

    const payload = {
      user_id: user.id,
      pix_key: s.pixKey || null,
      pix_key_type: s.pixKeyType || null,
      beneficiary_name: s.beneficiaryName || null,
      beneficiary_city: s.beneficiaryCity || null,
      beneficiary_document: s.beneficiaryDocument || null,
      receipt_stamp_url: s.receiptStampUrl || null,
      reminders_enabled: s.remindersEnabled,
      reminder_days_before: s.reminderDaysBefore,
      sales_module_enabled: s.salesModuleEnabled,
    } as any;

    if (isOnline) {
      const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' });
      if (error) { toast.error('Erro ao salvar: ' + error.message); throw error; }
    } else {
      await enqueueMutation({
        userId: user.id,
        type: 'UPDATE', // We use UPDATE with match user_id as a proxy for upsert since it's 1:1
        payload: { table: 'user_settings', data: payload, match: { user_id: user.id } }
      });
      toast.info('Alteração salva offline. Será sincronizada depois.');
    }

    setSettings(s);
    await Preferences.set({ key: `pix_settings_${user.id}`, value: JSON.stringify(s) });
    // Somente mostra toast de sucesso se não for offline
    if (isOnline) {
      toast.success('Configurações salvas');
    }
  }, [user]);

  const uploadStamp = useCallback(async (file: File): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    if (!assertOnline()) throw new Error('É necessário conexão com a internet para enviar uma nova assinatura.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Imagem deve ter no máximo 2MB');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${user.id}/stamp-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('receipt-stamps').upload(path, file, {
      cacheControl: '3600', upsert: true, contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('receipt-stamps').getPublicUrl(path);
    const url = data.publicUrl;
    
    // Cache immediate
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        await Preferences.set({ key: `stamp_cache_${url}`, value: reader.result as string });
      };
      reader.readAsDataURL(file);
    } catch (e) {}

    await save({ ...settings, receiptStampUrl: url });
    return url;
  }, [user, settings, save]);

  const uploadStampFromBase64 = useCallback(async (base64: string): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    // Convert Base64 to Blob
    const res = await fetch(base64);
    const blob = await res.blob();
    const ext = blob.type.split('/')[1] || 'png';
    
    const path = `${user.id}/stamp-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('receipt-stamps').upload(path, blob, {
      cacheControl: '3600', upsert: true, contentType: blob.type,
    });
    
    if (error) throw error;
    const { data } = supabase.storage.from('receipt-stamps').getPublicUrl(path);
    const url = data.publicUrl;
    
    // We don't call save() here because the caller (importBackup) will call savePix with all settings
    return url;
  }, [user]);

  const removeStamp = useCallback(async () => {
    if (!user) return;
    await save({ ...settings, receiptStampUrl: '' });
  }, [user, settings, save]);

  const isConfigured = !!(settings.pixKey && settings.beneficiaryName && settings.beneficiaryCity);

  return (
    <PixSettingsContext.Provider value={{ settings, loaded, isConfigured, save, uploadStamp, removeStamp, refresh, uploadStampFromBase64 }}>
      {children}
    </PixSettingsContext.Provider>
  );
}

export function usePixSettings() {
  const ctx = useContext(PixSettingsContext);
  if (!ctx) throw new Error('usePixSettings must be used inside PixSettingsProvider');
  return ctx;
}
