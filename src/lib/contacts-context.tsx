import React, { createContext, useContext, useCallback } from 'react';
import { useFinance } from './finance-context';

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  address?: string;
  cep?: string;
  notes?: string;
}

interface ContactsContextType {
  contacts: Contact[];
  loading: boolean;
  addContact: (c: Omit<Contact, 'id'>) => Promise<Contact | null>;
  updateContact: (c: Contact) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  importContacts: (list: Omit<Contact, 'id'>[]) => Promise<number>;
  findByName: (name: string) => Contact | undefined;
}

const ContactsContext = createContext<ContactsContextType | null>(null);

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, addContact, updateContact, deleteContact, importContacts } = useFinance();

  const findByName = useCallback((name: string) => {
    if (!name) return undefined;
    const n = name.trim().toLowerCase();
    return data.contacts.find(c => c.name.toLowerCase() === n);
  }, [data.contacts]);

  return (
    <ContactsContext.Provider value={{ 
      contacts: data.contacts, 
      loading, 
      addContact, 
      updateContact, 
      deleteContact, 
      importContacts, 
      findByName 
    }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error('useContacts must be used within ContactsProvider');
  return ctx;
}

// ---------- vCard parser (subset of RFC 6350) ----------
export function parseVCard(text: string): Omit<Contact, 'id'>[] {
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  const result: Omit<Contact, 'id'>[] = [];
  for (const block of cards) {
    const body = block.split(/END:VCARD/i)[0];
    const unfolded = body.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    let name = '';
    let phone = '';
    let email = '';
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const head = line.substring(0, idx).toUpperCase();
      const value = line.substring(idx + 1).trim();
      if (!value) continue;
      if (head === 'FN' || head.startsWith('FN;')) {
        name = value;
      } else if ((head === 'N' || head.startsWith('N;')) && !name) {
        const parts = value.split(';');
        name = [parts[3], parts[1], parts[2], parts[0], parts[4]].filter(Boolean).join(' ').trim();
      } else if (head === 'TEL' || head.startsWith('TEL;') || head.startsWith('TEL,')) {
        if (!phone) phone = value;
      } else if (head === 'EMAIL' || head.startsWith('EMAIL;') || head.startsWith('EMAIL,')) {
        if (!email) email = value;
      }
    }
    if (name) result.push({ name, phone: phone || undefined, email: email || undefined });
  }
  return result;
}

// ---------- WhatsApp helpers ----------
export function normalizePhoneForWhatsApp(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return digits;
}

export function whatsappLink(phone: string, message: string): string {
  const num = normalizePhoneForWhatsApp(phone);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
