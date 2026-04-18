import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { toast } from 'sonner';

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
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

function mapRow(row: any): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    document: row.document ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts').select('*').order('name');
    if (error) toast.error('Erro ao carregar contatos');
    else setContacts((data || []).map(mapRow));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const addContact = async (c: Omit<Contact, 'id'>) => {
    if (!user) return null;
    const { data, error } = await supabase.from('contacts').insert({
      user_id: user.id,
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      document: c.document || null,
      notes: c.notes || null,
    }).select().single();
    if (error) { toast.error('Erro ao salvar contato'); return null; }
    const created = mapRow(data);
    setContacts(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  };

  const updateContact = async (c: Contact) => {
    const { error } = await supabase.from('contacts').update({
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      document: c.document || null,
      notes: c.notes || null,
    }).eq('id', c.id);
    if (error) { toast.error('Erro ao atualizar contato'); return; }
    setContacts(prev => prev.map(x => x.id === c.id ? c : x).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir contato'); return; }
    setContacts(prev => prev.filter(x => x.id !== id));
  };

  const importContacts = async (list: Omit<Contact, 'id'>[]) => {
    if (!user || list.length === 0) return 0;
    // Skip duplicates by name (case-insensitive)
    const existingNames = new Set(contacts.map(c => c.name.toLowerCase()));
    const fresh = list.filter(c => c.name && !existingNames.has(c.name.toLowerCase()));
    if (fresh.length === 0) return 0;
    const rows = fresh.map(c => ({
      user_id: user.id,
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      document: c.document || null,
      notes: c.notes || null,
    }));
    const { data, error } = await supabase.from('contacts').insert(rows).select();
    if (error) { toast.error('Erro ao importar contatos'); return 0; }
    const inserted = (data || []).map(mapRow);
    setContacts(prev => [...prev, ...inserted].sort((a, b) => a.name.localeCompare(b.name)));
    return inserted.length;
  };

  const findByName = useCallback((name: string) => {
    if (!name) return undefined;
    const n = name.trim().toLowerCase();
    return contacts.find(c => c.name.toLowerCase() === n);
  }, [contacts]);

  return (
    <ContactsContext.Provider value={{ contacts, loading, addContact, updateContact, deleteContact, importContacts, findByName }}>
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
    // Unfold lines (RFC 6350 §3.2)
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
        // N: Last;First;Middle;Prefix;Suffix
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
  // Remove non-digits
  let digits = phone.replace(/\D/g, '');
  // If looks like a Brazilian phone without country code (10 or 11 digits), prepend 55
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return digits;
}

export function whatsappLink(phone: string, message: string): string {
  const num = normalizePhoneForWhatsApp(phone);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
