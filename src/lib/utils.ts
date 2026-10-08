import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/**
 * Gera um UUID (formato v4) DETERMINÍSTICO a partir de uma semente.
 * Usado em operações que precisam ser idempotentes (ex.: recebimento/pagamento parcial):
 * se a operação for repetida (duplo clique, retry após queda de internet, replay da fila offline),
 * os registros derivados terão o mesmo ID e o banco rejeitará a duplicata (erro 23505)
 * em vez de criar um segundo registro.
 */
export function deterministicId(seed: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const words = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  const hex = words.map((w) => w.toString(16).padStart(8, "0")).join("");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Retorna true se o erro parece ser falha de conexão (e não rejeição do servidor). */
export function isNetworkError(err: any): boolean {
  const msg = String(err?.message ?? err ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|network error|timeout|timed out|abort/i.test(msg);
}

export function removeAccents(str: string): string {

  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function formatTruncatedCode(code?: string | null, maxLength: number = 22): string {
  if (!code) return '';
  const trimmed = code.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const start = Math.ceil((maxLength - 3) / 2);
  const end = Math.floor((maxLength - 3) / 2);
  return `${trimmed.substring(0, start)}...${trimmed.substring(trimmed.length - end)}`;
}

export function parseNotesMetadata(rawNotes?: string | null): { notes?: string; pixKey?: string; barcode?: string } {
  if (!rawNotes) return {};
  let notes = rawNotes;
  let pixKey: string | undefined;
  let barcode: string | undefined;

  const pixMatch = notes.match(/\[PIX:\s*([^\]]+)\]/);
  if (pixMatch) {
    pixKey = pixMatch[1].trim();
    notes = notes.replace(/\[PIX:\s*([^\]]+)\]/g, '').trim();
  }

  const barcodeMatch = notes.match(/\[BARCODE:\s*([^\]]+)\]/);
  if (barcodeMatch) {
    barcode = barcodeMatch[1].trim();
    notes = notes.replace(/\[BARCODE:\s*([^\]]+)\]/g, '').trim();
  }

  return {
    notes: notes || undefined,
    pixKey,
    barcode,
  };
}

export function formatNotesMetadata(notes?: string | null, pixKey?: string | null, barcode?: string | null): string | null {
  let cleanNotes = (notes || '').trim();
  cleanNotes = cleanNotes.replace(/\[PIX:\s*([^\]]+)\]/g, '').replace(/\[BARCODE:\s*([^\]]+)\]/g, '').trim();

  const parts: string[] = [];
  if (cleanNotes) parts.push(cleanNotes);
  if (pixKey?.trim()) parts.push(`[PIX: ${pixKey.trim()}]`);
  if (barcode?.trim()) parts.push(`[BARCODE: ${barcode.trim()}]`);

  return parts.length > 0 ? parts.join('\n') : null;
}

