import { useRef, useState } from 'react';
import { usePersistedDialog, usePersistedFormDraft } from '@/hooks/usePersistedDialog';
import { Contact, parseVCard, useContacts, whatsappLink } from '@/lib/contacts-context';
import { Plus, Trash2, Edit2, Search, Upload, Smartphone, MessageCircle, Mail, User, Phone, IdCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Contacts as CapacitorContacts } from '@capacitor-community/contacts';
import { Checkbox } from '@/components/ui/checkbox';
import { removeAccents } from '@/lib/utils';

// Chrome Android Contact Picker API
declare global {
  interface Navigator {
    contacts?: {
      select: (props: string[], opts?: { multiple?: boolean }) => Promise<Array<{
        name?: string[];
        tel?: string[];
        email?: string[];
      }>>;
    };
  }
}

export default function ContactsPage() {
  const { contacts, addContact, updateContact, deleteContact, importContacts } = useContacts();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [dialogOpen, setDialogOpen] = usePersistedDialog('contacts-dialog');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Native Picker Modal State
  const [nativePickerOpen, setNativePickerOpen] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<any[]>([]);
  const [selectedDeviceContacts, setSelectedDeviceContacts] = useState<Set<string>>(new Set());
  const [deviceSearch, setDeviceSearch] = useState('');

  const normalizedSearch = removeAccents(search.toLowerCase());
  const filtered = contacts.filter(c =>
    removeAccents(c.name.toLowerCase()).includes(normalizedSearch) ||
    (c.phone || '').includes(normalizedSearch) ||
    removeAccents((c.email || '').toLowerCase()).includes(normalizedSearch)
  );

  const handleVCardFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseVCard(text);
      if (parsed.length === 0) {
        toast.error('Nenhum contato encontrado no arquivo');
        return;
      }
      const inserted = await importContacts(parsed);
      if (inserted === 0) toast.info('Todos os contatos já estavam cadastrados');
      else toast.success(`${inserted} contato${inserted > 1 ? 's' : ''} importado${inserted > 1 ? 's' : ''} (${parsed.length - inserted} duplicado${parsed.length - inserted !== 1 ? 's' : ''} ignorado${parsed.length - inserted !== 1 ? 's' : ''})`);
    } catch (e: any) {
      toast.error('Erro ao ler arquivo: ' + (e?.message || ''));
    } finally {
      setImporting(false);
    }
  };

  const handleNativePicker = async () => {
    setImporting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await CapacitorContacts.requestPermissions();
          if (perm.contacts !== 'granted') {
            toast.error('Permissão negada para acessar os contatos do aparelho');
            return;
          }
          
          toast.loading('Carregando contatos...', { id: 'loading-contacts' });
          const result = await CapacitorContacts.getContacts({
            projection: { name: true, phones: true, emails: true }
          });
          toast.dismiss('loading-contacts');

          const parsed = result.contacts
            .map(c => ({
              id: c.contactId,
              name: c.name?.display || '',
              phone: c.phones?.[0]?.number || undefined,
              email: c.emails?.[0]?.address || undefined,
            }))
            .filter(p => p.name);
          
          if (parsed.length === 0) {
            toast.info('Nenhum contato encontrado no aparelho');
            return;
          }

          setDeviceContacts(parsed);
          setSelectedDeviceContacts(new Set());
          setDeviceSearch('');
          setNativePickerOpen(true);
        } catch (e: any) {
          console.error("Native contacts error:", e);
          toast.error(`Não foi possível carregar os contatos nativos: ${e?.message || 'Erro desconhecido'}`);
        }
      } else {
        if (!navigator.contacts?.select) {
          toast.error('Seu navegador não suporta seleção nativa de contatos. Use a importação por arquivo (.vcf).');
          return;
        }
        const picked = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
        const parsed = picked.map(p => ({
          name: (p.name?.[0] || '').trim(),
          phone: p.tel?.[0] || undefined,
          email: p.email?.[0] || undefined,
        })).filter(p => p.name);
        if (parsed.length === 0) { toast.info('Nenhum contato selecionado'); return; }
        const inserted = await importContacts(parsed);
        toast.success(`${inserted} contato${inserted > 1 ? 's' : ''} importado${inserted > 1 ? 's' : ''}`);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Não foi possível acessar contatos');
    } finally {
      toast.dismiss('loading-contacts');
      setImporting(false);
    }
  };

  const handleConfirmNativeSelection = async () => {
    if (selectedDeviceContacts.size === 0) return;
    const toImport = deviceContacts.filter(c => selectedDeviceContacts.has(c.id)).map(c => ({
      name: c.name,
      phone: c.phone,
      email: c.email
    }));
    
    setNativePickerOpen(false);
    const inserted = await importContacts(toImport);
    toast.success(`${inserted} contato${inserted > 1 ? 's' : ''} importado${inserted > 1 ? 's' : ''}`);
  };

  const supportsNative = (typeof navigator !== 'undefined' && !!navigator.contacts?.select) || Capacitor.isNativePlatform();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-muted-foreground text-sm">Cadastre clientes e fornecedores para agilizar cobranças</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".vcf,text/vcard,text/x-vcard"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVCardFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4 mr-2" />
            Importar (.vcf)
          </Button>
          {supportsNative && (
            <Button variant="outline" onClick={handleNativePicker} disabled={importing}>
              <Smartphone className="h-4 w-4 mr-2" />
              Do celular
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}>
                <Plus className="h-4 w-4 mr-2" />Novo Contato
              </Button>
            </DialogTrigger>
            <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Contato</DialogTitle></DialogHeader>
              <ContactForm
                item={editing}
                onSave={async (c) => {
                  if (editing) await updateContact({ ...c, id: editing.id });
                  else await addContact(c);
                  setDialogOpen(false);
                  setEditing(null);
                  toast.success(editing ? 'Contato atualizado' : 'Contato criado');
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {!supportsNative && (
        <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40 border border-border">
          💡 No Chrome para Android você poderá selecionar contatos diretamente do celular. Em outros navegadores, exporte seus contatos como arquivo <strong>.vcf</strong> (vCard) e use o botão "Importar".
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="finance-card p-10 text-center text-muted-foreground">
          {contacts.length === 0 ? 'Nenhum contato cadastrado ainda.' : 'Nenhum contato encontrado.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="finance-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    {c.document && <div className="text-xs text-muted-foreground truncate">{c.document}</div>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                {c.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.phone}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
              </div>
              {(c.phone || c.email) && (
                <div className="flex gap-2 pt-1">
                  {c.phone && (
                    <a
                      href={whatsappLink(c.phone, `Olá ${c.name}!`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <MessageCircle className="h-3.5 w-3.5 mr-1" />
                        WhatsApp
                      </Button>
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        E-mail
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={async () => {
          if (deleteId) {
            await deleteContact(deleteId);
            setDeleteId(null);
            toast.success('Contato excluído');
          }
        }}
        title="Excluir contato?"
        description="Esta ação não pode ser desfeita."
      />

      <Dialog open={nativePickerOpen} onOpenChange={setNativePickerOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col gap-0 p-0" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle>Selecionar Contatos</DialogTitle>
          </DialogHeader>
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar contatos no aparelho..." value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 max-h-[50vh]">
            {deviceContacts
              .filter(c => removeAccents(c.name.toLowerCase()).includes(removeAccents(deviceSearch.toLowerCase())) || (c.phone || '').includes(deviceSearch))
              .map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => {
                  const next = new Set(selectedDeviceContacts);
                  if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                  setSelectedDeviceContacts(next);
                }}>
                  <Checkbox checked={selectedDeviceContacts.has(c.id)} onCheckedChange={(checked) => {
                    const next = new Set(selectedDeviceContacts);
                    if (checked) next.add(c.id); else next.delete(c.id);
                    setSelectedDeviceContacts(next);
                  }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    {c.phone && <p className="text-xs text-muted-foreground truncate">{c.phone}</p>}
                  </div>
                </div>
            ))}
          </div>
          <div className="p-4 border-t border-border flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNativePickerOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmNativeSelection} disabled={selectedDeviceContacts.size === 0}>
              Importar ({selectedDeviceContacts.size})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactForm({ item, onSave }: {
  item: Contact | null;
  onSave: (c: Omit<Contact, 'id'>) => void;
}) {
  const initialDraft = {
    name: item?.name || '',
    phone: item?.phone || '',
    email: item?.email || '',
    document: item?.document || '',
    cep: item?.cep || '',
    address: item?.address || '',
    notes: item?.notes || '',
  };
  // dialogOpen is not available here, so we always persist (form only mounts when dialog is open)
  const [draft, setDraft] = usePersistedFormDraft('contacts-form', true, initialDraft);
  const { name, phone, email, document, cep, address, notes } = draft;
  const setName = (v: string) => setDraft(d => ({ ...d, name: v }));
  const setPhone = (v: string) => setDraft(d => ({ ...d, phone: v }));
  const setEmail = (v: string) => setDraft(d => ({ ...d, email: v }));
  const setDocument = (v: string) => setDraft(d => ({ ...d, document: v }));
  const setCep = (v: string) => setDraft(d => ({ ...d, cep: v }));
  const setAddress = (v: string) => setDraft(d => ({ ...d, address: v }));
  const setNotes = (v: string) => setDraft(d => ({ ...d, notes: v }));

  return (
    <div className="space-y-4">
      <div>
        <Label>Nome *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Telefone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>CPF / CNPJ</Label>
          <Input value={document} onChange={e => setDocument(e.target.value)} placeholder="000.000.000-00" />
        </div>
        <div>
          <Label>CEP</Label>
          <Input value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" />
        </div>
      </div>
      <div>
        <Label>Endereço Completo</Label>
        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, Número, Bairro, Cidade - UF" />
      </div>
      <div>
        <Label>Notas</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" />
      </div>
      <Button
        className="w-full"
        disabled={!name.trim()}
        onClick={() => onSave({
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          document: document.trim() || undefined,
          cep: cep.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        })}
      >
        {item ? 'Atualizar' : 'Criar'} Contato
      </Button>
    </div>
  );
}
