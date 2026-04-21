import { openDB, IDBPDatabase } from 'idb';
import { FinanceData } from './types';

const DB_NAME = 'fluxopro-offline';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshot';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE);
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