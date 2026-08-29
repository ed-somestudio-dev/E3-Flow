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

export function removeAccents(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

