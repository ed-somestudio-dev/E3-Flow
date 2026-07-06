import { openDB, IDBPDatabase } from 'idb';
import { FinanceData } from './types';

const DB_NAME = 'e3flow-offline';
const DB_VERSION = 4; 
export const SNAPSHOT_STORE = 'snapshot';
export const SALES_SNAPSHOT_STORE = 'sales_snapshot';
export const SALES_LIST_SNAPSHOT_STORE = 'sales_list_snapshot';
const MUTATIONS_STORE = 'mutations_queue';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log(`[offline-db] Upgrading from ${oldVersion} to ${DB_VERSION}`);
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE);
        }
        if (!db.objectStoreNames.contains(SALES_SNAPSHOT_STORE)) {
          db.createObjectStore(SALES_SNAPSHOT_STORE);
        }
        if (!db.objectStoreNames.contains(SALES_LIST_SNAPSHOT_STORE)) {
          db.createObjectStore(SALES_LIST_SNAPSHOT_STORE);
        }
        if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
          db.createObjectStore(MUTATIONS_STORE, { keyPath: 'id', autoIncrement: true });
          console.log('[offline-db] Store mutations_queue criada');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Salva um snapshot dos dados no IndexedDB.
 */
export async function saveSnapshot(userId: string, data: any, store = SNAPSHOT_STORE): Promise<void> {
  try {
    const db = await getDB();
    await db.put(store, { data, savedAt: Date.now() }, userId);
  } catch (err) {
    console.warn(`[offline] falha ao salvar snapshot em ${store}:`, err);
  }
}

/**
 * Lê o snapshot mais recente.
 */
export async function loadSnapshot(userId: string, store = SNAPSHOT_STORE): Promise<{ data: any; savedAt: number } | null> {
  try {
    const db = await getDB();
    const result = await db.get(store, userId);
    return result || null;
  } catch (err) {
    console.warn(`[offline] falha ao ler snapshot em ${store}:`, err);
    return null;
  }
}

/**
 * Remove o snapshot (ex.: logout).
 */
export async function clearSnapshot(userId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(SNAPSHOT_STORE, userId);
    await db.delete(SALES_SNAPSHOT_STORE, userId);
    await db.delete(SALES_LIST_SNAPSHOT_STORE, userId);
  } catch {/* ignore */}
}

// --- Fila de Mutações Offline ---

export interface OfflineMutation {
  id?: number;
  userId: string;
  type: string;
  payload: any;
  timestamp: number;
}

export async function enqueueMutation(mutation: Omit<OfflineMutation, 'id' | 'timestamp'>): Promise<void> {
  try {
    console.log('[offline-store] Enfileirando mutação:', mutation.type, mutation.payload.table || mutation.payload.rpc);
    const db = await getDB();
    await db.add(MUTATIONS_STORE, {
      ...mutation,
      timestamp: Date.now(),
    });
    console.log('[offline-store] Mutação salva com sucesso no IndexedDB');
  } catch (err) {
    console.error('[offline-store] ERRO ao enfileirar mutação:', err);
  }
}

export async function getMutationsQueue(userId: string): Promise<OfflineMutation[]> {
  try {
    const db = await getDB();
    const all = await db.getAll(MUTATIONS_STORE).catch(e => {
      console.error('[offline-store] Falha crítica ao ler MUTATIONS_STORE:', e);
      return [];
    });
    const filtered = all.filter(m => m && m.userId === userId).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    console.log(`[offline-store] Fila lida para ${userId}: ${filtered.length} itens encontrados`);
    return filtered;
  } catch (err) {
    console.error('[offline-store] ERRO inesperado ao ler fila:', err);
    return [];
  }
}

export async function dequeueMutation(id: number): Promise<void> {
  try {
    console.log(`[offline-store] Removendo mutação ${id} da fila`);
    const db = await getDB();
    await db.delete(MUTATIONS_STORE, id);
  } catch (err) {
    console.error('[offline-store] ERRO ao remover mutação:', err);
  }
}

export async function clearMutationsQueue(userId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(MUTATIONS_STORE, 'readwrite');
    const store = tx.objectStore(MUTATIONS_STORE);
    const all = await store.getAll();
    for (const m of all) {
      if (m.userId === userId && m.id) {
        await store.delete(m.id);
      }
    }
    await tx.done;
  } catch (err) {
    console.error('[offline] erro ao limpar fila de mutações:', err);
  }
}

/**
 * Migra dados de um ID de visitante para um ID de usuário real.
 */
export async function migrateGuestData(guestId: string, realUserId: string): Promise<void> {
  if (!guestId || !realUserId || guestId === realUserId) return;
  console.log(`[offline-store] Migrando dados de ${guestId} para ${realUserId}`);
  
  try {
    const db = await getDB();
    const stores = [SNAPSHOT_STORE, SALES_SNAPSHOT_STORE, SALES_LIST_SNAPSHOT_STORE];
    
    // 1. Migrar Snapshots
    for (const storeName of stores) {
      const data = await db.get(storeName, guestId);
      if (data) {
        await db.put(storeName, data, realUserId);
        await db.delete(storeName, guestId);
        console.log(`[offline-store] Snapshot migrado na store ${storeName}`);
      }
    }
    
    // 2. Migrar Mutações na Fila
    const tx = db.transaction(MUTATIONS_STORE, 'readwrite');
    const store = tx.objectStore(MUTATIONS_STORE);
    const all = await store.getAll();
    for (const m of all) {
      if (m.userId === guestId) {
        await store.put({ ...m, userId: realUserId });
        console.log(`[offline-store] Mutação migrada: ${m.type}`);
      }
    }
    await tx.done;
    
    console.log('[offline-store] Migração concluída com sucesso');
  } catch (err) {
    console.error('[offline-store] Erro ao migrar dados de visitante:', err);
  }
}