import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_PREFIX = 'e3flow_dialog_';

/**
 * Persiste o estado open/closed de um diálogo no sessionStorage.
 * Quando o Android destrói a WebView e o React remonta, o diálogo
 * reabrirá automaticamente se estava aberto.
 */
export function usePersistedDialog(key: string): [boolean, (open: boolean) => void] {
  const storageKey = STORAGE_PREFIX + key;

  const [open, setOpenState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    try {
      if (value) {
        sessionStorage.setItem(storageKey, 'true');
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  return [open, setOpen];
}

/**
 * Persiste um rascunho de formulário no sessionStorage enquanto o diálogo está aberto.
 * Quando o Android mata a WebView, o rascunho é restaurado na re-montagem.
 *
 * @param key    Identificador único (ex: 'payables-form')
 * @param dialogOpen   Se o diálogo está aberto — limpa o draft ao fechar
 * @param initialValue  Valor inicial padrão do formulário
 */
export function usePersistedFormDraft<T extends Record<string, any>>(
  key: string,
  dialogOpen: boolean,
  initialValue: T
): [T, (updater: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = STORAGE_PREFIX + 'draft_' + key;
  const prevOpen = useRef(dialogOpen);

  const [draft, setDraftState] = useState<T>(() => {
    if (!dialogOpen) return initialValue;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...initialValue, ...parsed };
      }
    } catch { /* ignore */ }
    return initialValue;
  });

  // Persist draft to sessionStorage on every change (while dialog is open)
  useEffect(() => {
    if (!dialogOpen) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch { /* ignore */ }
  }, [draft, dialogOpen, storageKey]);

  // When dialog closes, clear the draft
  useEffect(() => {
    if (prevOpen.current && !dialogOpen) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch { /* ignore */ }
      // Reset to initial value
      setDraftState(initialValue);
    }
    prevOpen.current = dialogOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, storageKey]);

  const setDraft = useCallback((updater: T | ((prev: T) => T)) => {
    setDraftState(updater);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch { /* ignore */ }
    setDraftState(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return [draft, setDraft, clearDraft];
}

/**
 * Persiste o ID de um item sendo editado no sessionStorage.
 * Ao restaurar, a página pode buscar o item nos dados carregados.
 */
export function usePersistedEditingId<T extends { id: string } | null>(
  key: string,
  dialogOpen: boolean,
  items: { id: string }[]
): [T, (item: T) => void] {
  const storageKey = STORAGE_PREFIX + 'editing_' + key;
  const prevOpen = useRef(dialogOpen);

  const [editingItem, setEditingItemState] = useState<T>(() => {
    if (!dialogOpen) return null as T;
    try {
      const storedId = sessionStorage.getItem(storageKey);
      if (storedId && storedId !== 'null') {
        const found = items.find(i => i.id === storedId);
        return (found || null) as T;
      }
    } catch { /* ignore */ }
    return null as T;
  });

  // Persist editing item ID
  useEffect(() => {
    if (!dialogOpen) return;
    try {
      if (editingItem && typeof editingItem === 'object' && 'id' in editingItem) {
        sessionStorage.setItem(storageKey, (editingItem as any).id);
      } else {
        sessionStorage.setItem(storageKey, 'null');
      }
    } catch { /* ignore */ }
  }, [editingItem, dialogOpen, storageKey]);

  // Clear when dialog closes
  useEffect(() => {
    if (prevOpen.current && !dialogOpen) {
      try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
      setEditingItemState(null as T);
    }
    prevOpen.current = dialogOpen;
  }, [dialogOpen, storageKey]);

  const setEditingItem = useCallback((item: T) => {
    setEditingItemState(item);
  }, []);

  return [editingItem, setEditingItem];
}
