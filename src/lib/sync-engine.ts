import { getMutationsQueue, dequeueMutation, clearMutationsQueue } from './offline-store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let isSyncing = false;

/**
 * Processa a fila de mutações offline e envia para o Supabase.
 */
export async function syncOfflineMutations(userId: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (userId.startsWith('guest_')) return; // Visitantes não sincronizam com o servidor
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
      
      if (mutation.payload.table === 'products' && mutation.payload.data) {
        if ('category' in mutation.payload.data) {
          mutation.payload.data.category_id = mutation.payload.data.category;
          delete mutation.payload.data.category;
        }
        if ('unit_price' in mutation.payload.data) {
          mutation.payload.data.price = mutation.payload.data.unit_price;
          delete mutation.payload.data.unit_price;
        }
      }

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
    } catch (err: any) {
      console.error('[sync-engine] ERRO AO PROCESSAR:', mutation, err);
      
      // Erro 23503: Violação de chave estrangeira (ex: categoria não existe mais)
      // Erro 409: Conflito (dado já existe)
      if (err?.code === '23503' || err?.status === 409 || err?.code === 'PGRST116') {
        console.warn(`[sync-engine] Removendo item inconsistente da fila: ${err.message}`);
        if (mutation.id) await dequeueMutation(mutation.id);
        successCount++; // Contamos como "processado" para não travar a fila
        continue;
      }

      // Se for erro de autorização (token expirado), interrompe sem mostrar toast de erro
      if (err?.status === 401 || err?.message?.includes('JWT expired')) {
        console.warn('[sync-engine] Sessão expirada. Sincronização interrompida.');
        errorCount = 0;
        break;
      }

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
