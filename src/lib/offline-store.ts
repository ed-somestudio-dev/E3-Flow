import { openDB, IDBPDatabase } from 'idb';
import { FinanceData } from './types';

const DB_NAME = 'fluxopro-offline';
const DB_VERSION = 3; // Incremented to force upgrade and ensure store existence
const SNAPSHOT_STORE = 'snapshot';
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
 * Salva um snapshot dos dados financeiros do usuário no IndexedDB
 * para permitir leitura offline.
 */
export async function saveSnapshot(userId: string, data: FinanceData): Promise<void> {
  try {
    const db = await getDB();
    await db.put(SNAPSHOT_STORE, { data, savedAt: Date.now() }, userId);
  } catch (err) {
    console.warn('[offline] falha ao salvar snapshot:', err);
  }
}

/**
 * Lê o snapshot mais recente do usuário.
 */
export async function loadSnapshot(userId: string): Promise<{ data: FinanceData; savedAt: number } | null> {
  try {
    const db = await getDB();
    const result = await db.get(SNAPSHOT_STORE, userId);
    return result || null;
  } catch (err) {
    console.warn('[offline] falha ao ler snapshot:', err);
    return null;
  }
}

/**
 * Remove o snapshot do usuário (ex.: logout).
 */
export async function clearSnapshot(userId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(SNAPSHOT_STORE, userId);
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