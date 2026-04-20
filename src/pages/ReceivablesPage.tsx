import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { supabase } from '@/integrations/supabase/client';
import { usePixSettings } from '@/lib/pix-settings-context';
import { Receivable, ReceivableStatus, RecurrenceFrequency } from '@/lib/types';
import { Plus, Trash2, Edit2, CheckCircle, Search, CreditCard, CalendarIcon, X, RefreshCw, QrCode, Receipt, AlertTriangle } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { CalculatorInput } from '@/components/CalculatorInput';
import { ContactAutocomplete } from '@/components/ContactAutocomplete';
import { ShareDocumentDialog } from '@/components/ShareDocumentDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { motion } from 'framer-motion';
import { fmt, fmtDate } from '@/lib/format';
import { SAFE_LABELS } from '@/lib/safe-labels';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  generateChargePDF, generateChargePNG, generateChargesPDF,
  generateReceiptPDF, generateReceiptPNG,
} from '@/lib/documents';
import { toast } from 'sonner';

const statusLabels: Record<ReceivableStatus, string> = { pending: 'Pendente', received: 'Recebido', overdue: 'Atrasado' };

function StatusBadge({ status }: { status: ReceivableStatus }) {
  const cls = status === 'received' ? 'status-badge-paid' : status === 'overdue' ? 'status-badge-overdue' : 'status-badge-pending';
  return <span className={cls}>{statusLabels[status]}</span>;
}

export default function ReceivablesPage() {
  const { data, addReceivable, updateReceivable, deleteReceivable, markReceivableReceived, markReceivableReceivedPartial, getCategoryName, getAccountName } = useFinance();
  const { settings: pixSettings, isConfigured } = usePixSettings();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<Receivable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receivingIds, setReceivingIds] = useState<string[]>([]);
  const [receiveAccountId, setReceiveAccountId] = useState('');
  const [partialMode, setPartialMode] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pixWarningOpen, setPixWarningOpen] = useState(false);

  // Share dialog state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCfg, setShareCfg] = useState<{
    title: string;
    filenameBase: string;
    generatePDF: () => Promise<Blob>;
    generatePNG: () => Promise<Blob>;
    pixCopyText?: Promise<string>;
  } | null>(null);

  const setCurrentMonth = () => {
    setDateFrom(startOfMonth(new Date()));
    setDateTo(endOfMonth(new Date()));
  };
  const clearDateFilter = () => { setDateFrom(undefined); setDateTo(undefined); };

  const filtered = data.receivables
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => r.description.toLowerCase().includes(search.toLowerCase()) || r.clientName.toLowerCase().includes(search.toLowerCase()))
    .filter(r => {
      if (dateFrom && r.dueDate < format(dateFrom, 'yyyy-MM-dd')) return false;
      if (dateTo && r.dueDate > format(dateTo, 'yyyy-MM-dd')) return false;
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalFiltered = filtered.reduce((sum, r) => sum + r.amount, 0);
  const selectableReceivables = filtered.filter(r => r.status !== 'received');
  const allVisibleSelected = selectableReceivables.length > 0 && selectableReceivables.every(r => selectedIds.has(r.id));
  const selectedTotal = Array.from(selectedIds).reduce((s, id) => {
    const r = data.receivables.find(x => x.id === id);
    return s + (r?.amount || 0);
  }, 0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableReceivables.map(r => r.id)));
  };

  const handleMarkReceived = (id: string) => {
    const receivable = data.receivables.find(r => r.id === id);
    setReceivingIds([id]);
    setReceiveAccountId(receivable?.accountId || data.accounts[0]?.id || '');
    setPartialMode(false);
    setPartialAmount('');
    setReceiveDialogOpen(true);
  };

  const handleReceiveSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const first = data.receivables.find(r => r.id === ids[0]);
    setReceivingIds(ids);
    setReceiveAccountId(first?.accountId || data.accounts[0]?.id || '');
    setPartialMode(false);
    setPartialAmount('');
    setReceiveDialogOpen(true);
  };

  const confirmReceive = async () => {
    if (receivingIds.length === 0 || !receiveAccountId) return;
    const accName = data.accounts.find(a => a.id === receiveAccountId)?.name || '';
    const items = receivingIds.map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
    let partialAmtUsed = 0;
    if (partialMode) {
      const amt = parseFloat(partialAmount);
      if (!amt || amt <= 0) return;
      partialAmtUsed = amt;
      if (receivingIds.length === 1) {
        await markReceivableReceivedPartial(receivingIds[0], receiveAccountId, amt);
      } else {
        const total = items.reduce((s, r) => s + r.amount, 0);
        if (total <= 0) return;
        if (amt >= total) {
          for (const r of items) await markReceivableReceived(r.id, receiveAccountId);
        } else {
          const remaining = Math.round((total - amt) * 100) / 100;
          // 1) Dá baixa total em cada item selecionado
          for (const r of items) await markReceivableReceived(r.id, receiveAccountId);
          // 2) Cria um único novo recebível com o saldo restante
          const base = items[0];
          const earliestDue = items.map(i => i.dueDate).sort()[0];
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes.user?.id;
          if (uid) {
            const { error: insErr } = await supabase.from('receivables').insert({
              user_id: uid,
              client_name: base.clientName,
              description: `Saldo restante de ${items.length} recebíveis (${base.clientName})`,
              category_id: base.categoryId,
              account_id: base.accountId || null,
              amount: remaining,
              due_date: earliestDue,
              status: 'pending',
              notes: `Saldo restante de recebimento parcial agrupado. Total original: ${total.toFixed(2)}, recebido: ${amt.toFixed(2)}, itens: ${items.length}.`,
            });
            if (insErr) console.error('grouped partial insert error:', insErr);
          }
        }
      }
    } else {
      for (const id of receivingIds) {
        await markReceivableReceived(id, receiveAccountId);
      }
    }
    setReceiveDialogOpen(false);
    setSelectedIds(new Set());
    setReceivingIds([]);
    const wasPartial = partialMode;
    const partialAmt = partialAmtUsed;
    setPartialMode(false);
    setPartialAmount('');

    // Offer receipt generation
    if (items.length === 1 && !wasPartial) {
      const r = items[0];
      const today = format(new Date(), 'yyyy-MM-dd');
      openShare({
        title: 'Compartilhar Recibo',
        filenameBase: `recibo-${r.clientName.replace(/\s+/g, '_')}-${today}`,
        generatePDF: () => generateReceiptPDF({
          id: r.id, clientName: r.clientName, description: r.description,
          amount: r.amount, receivedDate: today, accountName: accName,
        }, isConfigured ? pixSettings : null),
        generatePNG: () => generateReceiptPNG({
          id: r.id, clientName: r.clientName, description: r.description,
          amount: r.amount, receivedDate: today, accountName: accName,
        }, isConfigured ? pixSettings : null),
      });
    } else if (items.length === 1 && wasPartial && partialAmt > 0 && partialAmt < items[0].amount) {
      const r = items[0];
      const today = format(new Date(), 'yyyy-MM-dd');
      openShare({
        title: 'Compartilhar Recibo (Parcial)',
        filenameBase: `recibo-parcial-${r.clientName.replace(/\s+/g, '_')}-${today}`,
        generatePDF: () => generateReceiptPDF({
          id: r.id, clientName: r.clientName, description: `${r.description} (parcial)`,
          amount: partialAmt, receivedDate: today, accountName: accName,
        }, isConfigured ? pixSettings : null),
        generatePNG: () => generateReceiptPNG({
          id: r.id, clientName: r.clientName, description: `${r.description} (parcial)`,
          amount: partialAmt, receivedDate: today, accountName: accName,
        }, isConfigured ? pixSettings : null),
      });
    } else if (items.length > 1) {
      // Aggregated receipt
      const today = format(new Date(), 'yyyy-MM-dd');
      const total = items.reduce((s, r) => s + r.amount, 0);
      const clientName = items.every(i => i.clientName === items[0].clientName) ? items[0].clientName : 'Diversos';
      const description = `${items.length} recebimentos: ` + items.map(i => i.description).join(', ');
      openShare({
        title: 'Compartilhar Recibo',
        filenameBase: `recibo-multiplo-${today}`,
        generatePDF: () => generateReceiptPDF({
          id: items[0].id, clientName, description,
          amount: total, receivedDate: today, accountName: accName,
        }, isConfigured ? pixSettings : null),
        generatePNG: () => generateReceiptPNG({
          id: items[0].id, clientName, description,
          amount: total, receivedDate: today, accountName: accName,
        }, isConfigured ? pixSettings : null),
      });
    }
  };

  const openShare = (cfg: NonNullable<typeof shareCfg>) => {
    setShareCfg(cfg);
    setShareOpen(true);
  };

  const handleGenerateCharge = (r: Receivable) => {
    if (!isConfigured) {
      setPixWarningOpen(true);
      return;
    }
    openShare({
      title: 'Compartilhar Cobrança PIX',
      filenameBase: `cobranca-${r.clientName.replace(/\s+/g, '_')}-${r.dueDate}`,
      generatePDF: () => generateChargePDF({
        id: r.id, clientName: r.clientName, description: r.description,
        amount: r.amount, dueDate: r.dueDate,
      }, pixSettings),
      generatePNG: () => generateChargePNG({
        id: r.id, clientName: r.clientName, description: r.description,
        amount: r.amount, dueDate: r.dueDate,
      }, pixSettings),
      pixCopyText: (async () => {
        const { generatePixBRCode } = await import('@/lib/pix');
        return generatePixBRCode({
          pixKey: pixSettings.pixKey,
          amount: r.amount,
          beneficiaryName: pixSettings.beneficiaryName,
          beneficiaryCity: pixSettings.beneficiaryCity,
          txid: r.id.replace(/-/g, '').substring(0, 25),
          description: r.description,
        });
      })(),
    });
  };

  const handleGenerateChargesSelected = () => {
    if (!isConfigured) { setPixWarningOpen(true); return; }
    const items = Array.from(selectedIds).map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
    if (items.length === 0) return;
    if (items.length === 1) { handleGenerateCharge(items[0]); return; }

    // Consolidated single charge: sum amounts, earliest due date
    const total = items.reduce((s, r) => s + r.amount, 0);
    const clientName = items.every(i => i.clientName === items[0].clientName) ? items[0].clientName : 'Diversos';
    const earliestDue = items.map(i => i.dueDate).sort()[0];
    const description = `${items.length} cobranças: ` + items.map(i => i.description).join(', ');
    const consolidated = {
      id: items[0].id,
      clientName,
      description: description.length > 70 ? description.substring(0, 67) + '...' : description,
      amount: total,
      dueDate: earliestDue,
    };
    openShare({
      title: `Cobrança PIX Consolidada (${items.length} itens)`,
      filenameBase: `cobranca-consolidada-${format(new Date(), 'yyyy-MM-dd')}`,
      generatePDF: () => generateChargePDF(consolidated, pixSettings),
      generatePNG: () => generateChargePNG(consolidated, pixSettings),
      pixCopyText: (async () => {
        const { generatePixBRCode } = await import('@/lib/pix');
        return generatePixBRCode({
          pixKey: pixSettings.pixKey,
          amount: total,
          beneficiaryName: pixSettings.beneficiaryName,
          beneficiaryCity: pixSettings.beneficiaryCity,
          txid: consolidated.id.replace(/-/g, '').substring(0, 25),
          description: consolidated.description,
        });
      })(),
    });
  };

  const receivingTotal = receivingIds.reduce((sum, id) => {
    const r = data.receivables.find(x => x.id === id);
    return sum + (r?.amount || 0);
  }, 0);
  const selectedReceiveAccount = data.accounts.find(a => a.id === receiveAccountId);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{SAFE_LABELS.receivables}</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus recebimentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Novo Recebível</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Novo'} Recebível</DialogTitle></DialogHeader>
            <ReceivableForm item={editingItem} categories={data.categories.filter(c => c.type === 'income')} accounts={data.accounts}
              onSave={(r) => { const { installments, ...receivable } = r; if (editingItem) updateReceivable({ ...receivable, id: editingItem.id } as Receivable); else addReceivable(receivable, installments); setDialogOpen(false); setEditingItem(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      {!isConfigured && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span className="flex-1">Configure seus dados PIX para gerar cobranças com QR Code.</span>
          <Link to="/settings"><Button variant="outline" size="sm">Configurar</Button></Link>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar recebíveis..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="received">Recebido</SelectItem>
            <SelectItem value="overdue">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant={dateFrom && dateTo && format(dateFrom, 'yyyy-MM') === format(new Date(), 'yyyy-MM') && format(dateTo, 'yyyy-MM') === format(new Date(), 'yyyy-MM') ? 'default' : 'outline'} size="sm" onClick={setCurrentMonth}>
          <CalendarIcon className="h-4 w-4 mr-2" />Mês Atual
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground text-sm">até</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearDateFilter}>
            <X className="h-4 w-4 mr-1" />Limpar
          </Button>
        )}
      </div>

      {/* Totals + bulk actions */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border flex-wrap">
        <span className="text-sm text-muted-foreground">Total exibido:</span>
        <span className="text-lg font-bold text-success mono">{fmt(totalFiltered)}</span>
        <span className="text-xs text-muted-foreground">({filtered.length} {filtered.length === 1 ? 'item' : 'itens'})</span>
        {selectedIds.size > 0 && (
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Selecionado: <strong className="text-foreground mono">{fmt(selectedTotal)}</strong> ({selectedIds.size})</span>
            <Button size="sm" variant="outline" onClick={handleGenerateChargesSelected}>
              <QrCode className="h-4 w-4 mr-1" />
              Gerar boleto PIX
            </Button>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={handleReceiveSelected}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Receber selecionados
            </Button>
          </div>
        )}
      </div>

      <div className="finance-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 py-3 px-3">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" disabled={selectableReceivables.length === 0} />
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descrição</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Categoria</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Conta</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3">
                    {r.status !== 'received' && (
                      <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} aria-label="Selecionar" />
                    )}
                  </td>
                  <td className="py-3 px-4 mono text-muted-foreground">{fmtDate(r.dueDate)}</td>
                  <td className="py-3 px-4 font-medium">{r.clientName}</td>
                  <td className="py-3 px-4 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      {r.description}
                      {r.recurring && <RefreshCw className="h-3 w-3 text-primary" />}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{getCategoryName(r.categoryId)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{r.accountId ? getAccountName(r.accountId) : '—'}</td>
                  <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                  <td className="py-3 px-4 text-right mono font-semibold text-success">{fmt(r.amount)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== 'received' && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => handleGenerateCharge(r)} title="Gerar boleto PIX">
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={() => handleMarkReceived(r.id)} title="Marcar como recebido">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingItem(r); setDialogOpen(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhum recebível encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">{receivingIds.length > 1 ? `${receivingIds.length} itens` : 'Valor'}</span>
              <span className="text-lg font-bold text-success mono">{fmt(receivingTotal)}</span>
            </div>
            <div className="space-y-2">
              <Label>Conta para crédito</Label>
              <Select value={receiveAccountId} onValueChange={setReceiveAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                <SelectContent>{data.accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{a.name}</span>
                      <span className="text-xs text-muted-foreground mono">Saldo: {fmt(a.balance)}</span>
                    </div>
                  </SelectItem>
                ))}</SelectContent>
              </Select>
              {selectedReceiveAccount && (
                <p className="text-xs text-muted-foreground">
                  Saldo após recebimento: <span className="font-semibold mono">{fmt(selectedReceiveAccount.balance + (partialMode && partialAmount ? parseFloat(partialAmount) || 0 : receivingTotal))}</span>
                </p>
              )}
            </div>
            {(() => {
              const recItems = receivingIds.map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
              const sameClient = recItems.length > 0 && recItems.every(r => r.clientName === recItems[0].clientName);
              const allowPartial = recItems.length === 1 || (recItems.length > 1 && sameClient);
              return allowPartial && (
              <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Checkbox id="partialReceive" checked={partialMode} onCheckedChange={(c) => {
                    const checked = c === true;
                    setPartialMode(checked);
                    if (checked && !partialAmount) setPartialAmount((receivingTotal / 2).toFixed(2));
                    if (!checked) setPartialAmount('');
                  }} />
                  <Label htmlFor="partialReceive" className="cursor-pointer text-sm">
                    Recebimento parcial{recItems.length > 1 ? ` (${recItems.length} itens · ${recItems[0].clientName})` : ''}
                  </Label>
                </div>
                {partialMode && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {recItems.length > 1 ? 'Valor total recebido agora (será distribuído proporcionalmente)' : 'Valor recebido agora'}
                    </Label>
                    <Input type="number" step="0.01" min="0.01" max={receivingTotal} value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)} placeholder="0,00" />
                    {partialAmount && parseFloat(partialAmount) > 0 && parseFloat(partialAmount) < receivingTotal && (
                      <p className="text-xs text-muted-foreground">
                        Saldo restante: <span className="font-semibold mono text-success">{fmt(receivingTotal - parseFloat(partialAmount))}</span> — {recItems.length > 1 ? 'será criado um novo recebível pendente para cada item com o respectivo saldo restante.' : 'será criado um novo recebível pendente com os mesmos dados.'}
                      </p>
                    )}
                    {partialAmount && parseFloat(partialAmount) >= receivingTotal && (
                      <p className="text-xs text-warning">Valor igual ou maior que o total — será registrado como recebimento integral.</p>
                    )}
                  </div>
                )}
              </div>
              );
            })()}
            <Button className="w-full" disabled={!receiveAccountId || (partialMode && (!partialAmount || parseFloat(partialAmount) <= 0))} onClick={confirmReceive}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {partialMode ? 'Confirmar Recebimento Parcial' : 'Confirmar Recebimento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIX not configured warning */}
      <Dialog open={pixWarningOpen} onOpenChange={setPixWarningOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configuração PIX necessária</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para gerar cobranças PIX é preciso cadastrar sua chave PIX, nome e cidade nas configurações.
            </p>
            <Link to="/settings" onClick={() => setPixWarningOpen(false)}>
              <Button className="w-full">Ir para Configurações</Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {shareCfg && (
        <ShareDocumentDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          title={shareCfg.title}
          filenameBase={shareCfg.filenameBase}
          generatePDF={shareCfg.generatePDF}
          generatePNG={shareCfg.generatePNG}
          pixCopyText={shareCfg.pixCopyText}
        />
      )}

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteReceivable(deleteId); setDeleteId(null); } }}
        title="Excluir recebível?" description="Tem certeza que deseja excluir este recebível? Esta ação não pode ser desfeita." />
    </div>
  );
}

function ReceivableForm({ item, categories, accounts, onSave }: {
  item: Receivable | null; categories: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  onSave: (r: Omit<Receivable, 'id'> & { installments?: number }) => void;
}) {
  const [clientName, setClientName] = useState(item?.clientName || '');
  const [description, setDescription] = useState(item?.description || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [accountId, setAccountId] = useState(item?.accountId || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [dueDate, setDueDate] = useState(item?.dueDate || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [useInstallments, setUseInstallments] = useState(false);
  const [installments, setInstallments] = useState(2);
  const [inputMode, setInputMode] = useState<'total' | 'installment'>('total');
  const [installmentValue, setInstallmentValue] = useState('');
  const [recurring, setRecurring] = useState(item?.recurring || false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>(item?.recurrenceFrequency || 'monthly');

  const installmentAmount = amount ? (parseFloat(amount) / installments) : 0;

  return (
    <div className="space-y-4">
      <div><Label>Nome do Cliente</Label><ContactAutocomplete value={clientName} onChange={setClientName} placeholder="Nome do cliente" /></div>
      <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Categoria</Label>
          <Select value={categoryId || undefined} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Conta</Label>
          <Select value={accountId || undefined} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Valor Total</Label><CalculatorInput value={amount} onChange={setAmount} /></div>
        <div><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
      </div>

      <div className="space-y-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2">
          <Checkbox id="useInstallmentsRec" checked={useInstallments} onCheckedChange={(c) => { setUseInstallments(c === true); if (c) setRecurring(false); if (!c) setInstallments(2); }} />
          <Label htmlFor="useInstallmentsRec" className="cursor-pointer flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-primary" />
            Parcelar
          </Label>
        </div>
        {useInstallments && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Informar por:</Label>
              <Button type="button" variant={inputMode === 'total' ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
                onClick={() => { setInputMode('total'); setInstallmentValue(''); }}>Valor Total</Button>
              <Button type="button" variant={inputMode === 'installment' ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
                onClick={() => { setInputMode('installment'); setInstallmentValue(amount ? (parseFloat(amount) / installments).toFixed(2) : ''); }}>Valor da Parcela</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nº de Parcelas</Label>
                <Input type="number" min="2" max="48" value={installments} onChange={e => {
                  const raw = e.target.value;
                  const parsed = parseInt(raw);
                  if (raw === '' || isNaN(parsed)) { setInstallments('' as any); return; }
                  const n = Math.min(48, parsed);
                  setInstallments(n);
                  if (inputMode === 'installment' && installmentValue) {
                    setAmount((parseFloat(installmentValue) * n).toFixed(2));
                  }
                }} onBlur={() => { if (!installments || installments < 2) setInstallments(2); }} />
              </div>
              {inputMode === 'installment' ? (
                <div>
                  <Label>Valor da Parcela</Label>
                  <Input type="number" step="0.01" value={installmentValue} onChange={e => {
                    setInstallmentValue(e.target.value);
                    if (e.target.value) setAmount((parseFloat(e.target.value) * installments).toFixed(2));
                  }} />
                </div>
              ) : (
                <div className="flex items-end">
                  <p className="text-sm text-muted-foreground pb-2">
                    {installments}x de <span className="font-semibold text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installmentAmount)}</span>
                  </p>
                </div>
              )}
            </div>
            {inputMode === 'installment' && installmentValue && (
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount) || 0)}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {!useInstallments && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox id="recurringRec" checked={recurring} onCheckedChange={(c) => setRecurring(c === true)} />
            <Label htmlFor="recurringRec" className="cursor-pointer flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              Recebimento recorrente
            </Label>
          </div>
          {recurring && (
            <div><Label>Frequência</Label>
              <Select value={recurrenceFrequency} onValueChange={v => setRecurrenceFrequency(v as RecurrenceFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      <div><Label>Notas (opcional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <Button className="w-full" disabled={!clientName || !description || !categoryId || !amount || !dueDate}
        onClick={() => onSave({
          clientName, description, categoryId, accountId: accountId || undefined,
          amount: parseFloat(amount), dueDate, status: item?.status || 'pending',
          notes: notes || undefined,
          recurring: (!useInstallments && recurring) || undefined,
          recurrenceFrequency: (!useInstallments && recurring) ? recurrenceFrequency : undefined,
          installments: (useInstallments && installments > 1) ? installments : undefined,
        })}>
        {item ? 'Atualizar' : 'Criar'} Recebível
      </Button>
    </div>
  );
}
