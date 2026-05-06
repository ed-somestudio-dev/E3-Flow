import { getMutationsQueue, dequeueMutation, clearMutationsQueue } from './offline-store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let isSyncing = false;

/**
 * Processa a fila de mutações offline e envia para o Supabase.
 */
export async function syncOfflineMutations(userId: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (isSyncing) return;
  
  const queue = await getMutationsQueue(userId);
  if (queue.length === 0) return;

  isSyncing = true;
  toast.info(`Sincronizando ${queue.length} alterações offline...`);

  let successCount = 0;
  let errorCount = 0;

  for (const mutation of queue) {
    try {
      console.log(`[sync-engine] Processando ${mutation.type} em ${mutation.payload.table || 'RPC'}`, mutation.payload);
      
      if (mutation.type === 'INSERT') {
        const { error } = await supabase.from(mutation.payload.table).insert(mutation.payload.data);
        if (error) throw error;
      } else if (mutation.type === 'UPDATE') {
        let query = supabase.from(mutation.payload.table).update(mutation.payload.data);
        // Apply match conditions
        for (const [key, value] of Object.entries(mutation.payload.match)) {
          query = query.eq(key, value);
        }
        const { error, status } = await query;
        if (error) throw error;
        console.log(`[sync-engine] UPDATE concluído. Status: ${status}`);
      } else if (mutation.type === 'DELETE') {
        let query = supabase.from(mutation.payload.table).delete();
        if (mutation.payload.matchIn) {
           query = (query as any).in(mutation.payload.matchIn.column, mutation.payload.matchIn.values);
        }
        for (const [key, value] of Object.entries(mutation.payload.match || {})) {
          query = query.eq(key, value);
        }
        const { error } = await query;
        if (error) throw error;
      } else if (mutation.type === 'RPC') {
        console.log(`[sync-engine] Executando RPC: ${mutation.payload.rpc}`, mutation.payload.args);
        const { error } = await supabase.rpc(mutation.payload.rpc, mutation.payload.args);
        if (error) throw error;
      }
      
      console.log(`[sync-engine] SUCESSO: ${mutation.type} processado.`);

      // Se sucesso, remove da fila
      if (mutation.id) {
        await dequeueMutation(mutation.id);
      }
      successCount++;
    } catch (err) {
      console.error('[sync-engine] ERRO CRÍTICO:', mutation, err);
      errorCount++;
      break;
    }
  }

  isSyncing = false;

  if (successCount > 0 && errorCount === 0) {
    toast.success(`Sincronização concluída (${successCount} itens).`);
  } else if (errorCount > 0) {
    toast.error(`Falha ao sincronizar alguns itens. Tentaremos novamente depois.`);
  }

  return successCount > 0; // retorna true se algo foi sincronizado
}
