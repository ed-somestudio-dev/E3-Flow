import { useState, useCallback, useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import { supabase } from '@/integrations/supabase/client';
import { Payable, PayableStatus, RecurrenceFrequency } from '@/lib/types';
import { Plus, Trash2, Edit2, CheckCircle, Search, RefreshCw, CreditCard, Wallet, ChevronDown, ChevronRight, CalendarIcon, X } from 'lucide-react';
import { CalculatorInput } from '@/components/CalculatorInput';
import { ContactAutocomplete } from '@/components/ContactAutocomplete';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
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

const statusLabels: Record<PayableStatus, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencida' };

function StatusBadge({ status }: { status: PayableStatus }) {
  const cls = status === 'paid' ? 'status-badge-paid' : status === 'overdue' ? 'status-badge-overdue text-destructive font-semibold' : 'status-badge-pending';
  return <span className={cls}>{statusLabels[status]}</span>;
}

function CreditCardInvoiceCard({ accName, invoicesByMonth, onMarkPaid, onPayAll, onDelete, onEdit }: {
  accName: string;
  invoicesByMonth: Record<string, Payable[]>;
  onMarkPaid: (id: string) => void;
  onPayAll: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onEdit: (p: Payable) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allInvoices = Object.values(invoicesByMonth).flat();
  const totalPending = allInvoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amount, 0);
  const pendingCount = allInvoices.filter(i => i.status !== 'paid').length;

  const sortedMonths = Object.keys(invoicesByMonth).sort();

  return (
    <div className="finance-card p-0 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
          <CreditCard className="h-4 w-4 text-primary" />
          <span className="font-semibold">{accName}</span>
          <span className="text-xs text-muted-foreground">({pendingCount} pendente{pendingCount !== 1 ? 's' : ''})</span>
        </div>
        <span className="text-sm mono font-semibold text-destructive">
          {fmt(totalPending)}
        </span>
      </button>
      {expanded && (
        <div className="divide-y divide-border">
          {sortedMonths.map(monthKey => {
            const items = invoicesByMonth[monthKey];
            const pendingItems = items.filter(i => i.status !== 'paid');
            const pendingIds = pendingItems.map(i => i.id);
            const hasPending = pendingIds.length > 0;
            const monthTotal = pendingItems.reduce((s, i) => s + i.amount, 0);
            const invoiceDueDate = items[0]?.dueDate || '';
            const allPaid = items.every(i => i.status === 'paid');
            const hasOverdue = items.some(i => i.status === 'overdue');
            const invoiceStatus: PayableStatus = allPaid ? 'paid' : hasOverdue ? 'overdue' : 'pending';

            return (
              <InvoiceMonthGroup
                key={monthKey}
                monthKey={monthKey}
                items={items}
                invoiceDueDate={invoiceDueDate}
                invoiceStatus={invoiceStatus}
                monthTotal={monthTotal}
                hasPending={hasPending}
                pendingIds={pendingIds}
                onPayAll={onPayAll}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function InvoiceMonthGroup({ monthKey, items, invoiceDueDate, invoiceStatus, monthTotal, hasPending, pendingIds, onPayAll, onDelete, onEdit }: {
  monthKey: string;
  items: Payable[];
  invoiceDueDate: string;
  invoiceStatus: PayableStatus;
  monthTotal: number;
  hasPending: boolean;
  pendingIds: string[];
  onPayAll: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onEdit: (p: Payable) => void;
}) {
  const [open, setOpen] = useState(true);
  const [y, m] = monthKey.split('-');
  const monthLabel = `${m}/${y}`;

  return (
    <div>
      <div className="px-4 py-2 bg-muted/20 border-b border-border">
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            <span className="text-sm font-medium whitespace-nowrap">Fatura {monthLabel}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">Venc: <strong className="text-foreground">{fmtDate(invoiceDueDate)}</strong></span>
            <StatusBadge status={invoiceStatus} />
          </div>
          <span className="text-sm mono font-semibold text-destructive whitespace-nowrap ml-2">{fmt(monthTotal)}</span>
        </button>
        {hasPending && (
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10 hover:text-success h-7 text-xs" onClick={(e) => { e.stopPropagation(); onPayAll(pendingIds); }}>
              <CheckCircle className="h-3 w-3 mr-1" />
              Pagar Fatura
            </Button>
          </div>
        )}
      </div>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-4 font-medium text-muted-foreground text-xs">Data da Compra</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground text-xs">Descrição</th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground text-xs">Valor</th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground text-xs"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-4 mono text-muted-foreground whitespace-nowrap">{fmtDate(p.purchaseDate || p.dueDate)}</td>
                  <td className="py-2 px-4 font-medium">{p.description}</td>
                  <td className="py-2 px-4 text-right mono font-semibold text-destructive whitespace-nowrap">{fmt(p.amount)}</td>
                  <td className="py-2 px-4 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(p); }} aria-label="Editar"><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PayablesPage() {
  const { data, addPayable, updatePayable, deletePayable, deletePayableWithFuture, markPayablePaid, markPayablePaidPartial, getCategoryName, getAccountName } = useFinance();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<Payable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAccountId, setPayAccountId] = useState('');
  const [partialMode, setPartialMode] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));

  const setCurrentMonth = () => {
    setDateFrom(startOfMonth(new Date()));
    setDateTo(endOfMonth(new Date()));
  };

  const clearDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const allFiltered = data.payables
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => p.description.toLowerCase().includes(search.toLowerCase()) || p.supplier.toLowerCase().includes(search.toLowerCase()))
    .filter(p => {
      if (dateFrom && p.dueDate < format(dateFrom, 'yyyy-MM-dd')) return false;
      if (dateTo && p.dueDate > format(dateTo, 'yyyy-MM-dd')) return false;
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const regularPayables = allFiltered.filter(p => !p.supplier?.startsWith('cartao:'));
  const creditPayables = allFiltered.filter(p => p.supplier?.startsWith('cartao:'));

  // Group credit payables by account
  const creditByAccount = creditPayables.reduce<Record<string, Payable[]>>((acc, p) => {
    const accId = p.supplier.replace('cartao:', '');
    if (!acc[accId]) acc[accId] = [];
    acc[accId].push(p);
    return acc;
  }, {});

  const [payingIds, setPayingIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectablePayables = regularPayables.filter(p => p.status !== 'paid');
  const allVisibleSelected = selectablePayables.length > 0 && selectablePayables.every(p => selectedIds.has(p.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectablePayables.map(p => p.id)));
  };

  const handleMarkPaid = (id: string) => {
    const payable = data.payables.find(p => p.id === id);
    setPayingIds([id]);
    setPayAccountId(payable?.accountId || data.accounts[0]?.id || '');
    setPartialMode(false);
    setPartialAmount('');
    setPayDialogOpen(true);
  };

  const handlePayAll = (ids: string[]) => {
    const first = data.payables.find(p => p.id === ids[0]);
    setPayingIds(ids);
    setPayAccountId(first?.accountId || data.accounts[0]?.id || '');
    setPartialMode(false);
    setPartialAmount('');
    setPayDialogOpen(true);
  };

  const handlePaySelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    handlePayAll(ids);
  };

  const confirmPay = async () => {
    if (payingIds.length > 0 && payAccountId) {
      if (partialMode) {
        const amt = parseFloat(partialAmount);
        if (!amt || amt <= 0) return;
        if (payingIds.length === 1) {
          await markPayablePaidPartial(payingIds[0], payAccountId, amt);
        } else {
          // FIFO: paga itens mais antigos primeiro até esgotar o valor
          const items = (payingIds
            .map(id => data.payables.find(x => x.id === id))
            .filter(Boolean) as Payable[])
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
          const total = items.reduce((s, p) => s + p.amount, 0);
          if (total <= 0) return;
          if (amt >= total) {
            for (const p of items) await markPayablePaid(p.id, payAccountId);
          } else {
            let remaining = amt;
            for (const p of items) {
              if (remaining <= 0) break;
              if (remaining >= p.amount - 0.005) {
                // quita integralmente este item
                await markPayablePaid(p.id, payAccountId);
                remaining = Math.round((remaining - p.amount) * 100) / 100;
              } else {
                // pagamento parcial deste item — gera saldo restante individual
                await markPayablePaidPartial(p.id, payAccountId, Math.round(remaining * 100) / 100);
                remaining = 0;
              }
            }
          }
        }
      } else {
        for (const id of payingIds) {
          await markPayablePaid(id, payAccountId);
        }
      }
      setPayDialogOpen(false);
      setSelectedIds(new Set());
      setPayingIds([]);
      setPartialMode(false);
      setPartialAmount('');
    }
  };

  const payingTotal = payingIds.reduce((sum, id) => {
    const p = data.payables.find(x => x.id === id);
    return sum + (p?.amount || 0);
  }, 0);
  const selectedPayAccount = data.accounts.find(a => a.id === payAccountId);
  const selectedTotal = Array.from(selectedIds).reduce((s, id) => {
    const p = data.payables.find(x => x.id === id);
    return s + (p?.amount || 0);
  }, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{SAFE_LABELS.payables}</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas despesas e contas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Nova'} {SAFE_LABELS.payable}</DialogTitle></DialogHeader>
            <PayableForm item={editingItem} categories={data.categories.filter(c => c.type === 'expense')} accounts={data.accounts}
              onSave={(p) => { const { installments, isCredit, recurrence, ...payable } = p; if (editingItem) updatePayable({ ...payable, id: editingItem.id } as Payable); else addPayable(payable, installments, isCredit, recurrence); setDialogOpen(false); setEditingItem(null); }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
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
      {/* Totals + bulk action */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border flex-wrap">
        <span className="text-sm text-muted-foreground">Total exibido:</span>
        <span className="text-lg font-bold text-destructive mono">{fmt(allFiltered.reduce((s, p) => s + p.amount, 0))}</span>
        <span className="text-xs text-muted-foreground">({allFiltered.length} {allFiltered.length === 1 ? 'item' : 'itens'})</span>
        {selectedIds.size > 0 && (
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">Selecionado: <strong className="text-foreground mono">{fmt(selectedTotal)}</strong> ({selectedIds.size})</span>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={handlePaySelected}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Pagar selecionados
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
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" disabled={selectablePayables.length === 0} />
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descrição</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fornecedor</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Categoria</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Conta</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {regularPayables.map(p => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3">
                    {p.status !== 'paid' && (
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} aria-label="Selecionar" />
                    )}
                  </td>
                  <td className="py-3 px-4 mono text-muted-foreground">{fmtDate(p.dueDate)}</td>
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-1.5">
                      {p.description}
                      {p.recurring && <RefreshCw className="h-3 w-3 text-primary" />}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{p.supplier}</td>
                  <td className="py-3 px-4 text-muted-foreground">{getCategoryName(p.categoryId)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.accountId ? getAccountName(p.accountId) : '—'}</td>
                  <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                  <td className="py-3 px-4 text-right mono font-semibold text-destructive">{fmt(p.amount)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status !== 'paid' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={() => handleMarkPaid(p.id)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingItem(p); setDialogOpen(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {regularPayables.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhuma conta encontrada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Card Invoices Section */}
      {Object.keys(creditByAccount).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Faturas de Cartão de Crédito
          </h2>
          {Object.entries(creditByAccount).map(([accountId, invoices]) => {
            const accName = getAccountName(accountId);
            // Group by invoice month (dueDate year-month)
            const byMonth = invoices.reduce<Record<string, Payable[]>>((acc, p) => {
              const key = p.dueDate.substring(0, 7); // YYYY-MM
              if (!acc[key]) acc[key] = [];
              acc[key].push(p);
              return acc;
            }, {});
            return (
              <CreditCardInvoiceCard
                key={accountId}
                accName={accName}
                invoicesByMonth={byMonth}
                onMarkPaid={handleMarkPaid}
                onPayAll={handlePayAll}
                onDelete={(id) => setDeleteId(id)}
                onEdit={(p) => { setEditingItem(p); setDialogOpen(true); }}
              />
            );
          })}
        </div>
      )}

      {/* Pay dialog - select account */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">{payingIds.length > 1 ? `${payingIds.length} itens` : 'Valor'}</span>
              <span className="text-lg font-bold text-destructive mono">{fmt(payingTotal)}</span>
            </div>
            <div className="space-y-2">
              <Label>Conta para débito</Label>
              <Select value={payAccountId} onValueChange={setPayAccountId}>
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
              {selectedPayAccount && (
                <p className="text-xs text-muted-foreground">
                  Saldo após pagamento: <span className="font-semibold mono">{fmt(selectedPayAccount.balance - (partialMode && partialAmount ? parseFloat(partialAmount) || 0 : payingTotal))}</span>
                </p>
              )}
            </div>
            {(() => {
              const payingItems = payingIds.map(id => data.payables.find(x => x.id === id)).filter(Boolean) as Payable[];
              const sameSupplier = payingItems.length > 0 && payingItems.every(p => p.supplier === payingItems[0].supplier);
              const allowPartial = payingItems.length === 1 || (payingItems.length > 1 && sameSupplier);
              return allowPartial && (
              <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Checkbox id="partialPay" checked={partialMode} onCheckedChange={(c) => {
                    const checked = c === true;
                    setPartialMode(checked);
                    if (checked && !partialAmount) setPartialAmount((payingTotal / 2).toFixed(2));
                    if (!checked) setPartialAmount('');
                  }} />
                  <Label htmlFor="partialPay" className="cursor-pointer text-sm">
                    Pagamento parcial{payingItems.length > 1 ? ` (${payingItems.length} itens · ${payingItems[0].supplier})` : ''}
                  </Label>
                </div>
                {partialMode && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {payingItems.length > 1 ? 'Valor pago agora (FIFO — quita as mais antigas primeiro)' : 'Valor pago agora'}
                    </Label>
                    <Input type="number" step="0.01" min="0.01" max={payingTotal} value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)} placeholder="0,00" />
                    {partialAmount && parseFloat(partialAmount) > 0 && parseFloat(partialAmount) < payingTotal && (
                      <p className="text-xs text-muted-foreground">
                        Saldo restante: <span className="font-semibold mono text-destructive">{fmt(payingTotal - parseFloat(partialAmount))}</span> — {payingItems.length > 1 ? `as contas mais antigas serão quitadas integralmente; a próxima ficará parcial com saldo restante individual.` : 'será criada uma nova conta pendente com os mesmos dados.'}
                      </p>
                    )}
                    {partialAmount && parseFloat(partialAmount) >= payingTotal && (
                      <p className="text-xs text-warning">Valor igual ou maior que o total — será registrado como pagamento integral.</p>
                    )}
                  </div>
                )}
              </div>
              );
            })()}
            <Button className="w-full" disabled={!payAccountId || (partialMode && (!partialAmount || parseFloat(partialAmount) <= 0))} onClick={confirmPay}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {partialMode ? 'Confirmar Pagamento Parcial' : 'Confirmar Pagamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deletePayable(deleteId); setDeleteId(null); } }}
        title="Excluir conta a pagar?" description="Tem certeza que deseja excluir esta conta a pagar? Esta ação não pode ser desfeita." />
    </div>
  );
}

function PayableForm({ item, categories, accounts, onSave }: {
  item: Payable | null; categories: { id: string; name: string }[];
  accounts: { id: string; name: string; type?: string; billingCloseDay?: number; dueDay?: number }[];
  onSave: (p: Omit<Payable, 'id'> & { installments?: number; isCredit?: boolean; recurrence?: { frequency: RecurrenceFrequency; occurrences: number } }) => void;
}) {
  const [description, setDescription] = useState(item?.description || '');
  const [supplier, setSupplier] = useState(item?.supplier || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [accountId, setAccountId] = useState(item?.accountId || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [dueDate, setDueDate] = useState(item?.dueDate || '');
  const [purchaseDate, setPurchaseDate] = useState(item?.purchaseDate || new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(item?.notes || '');
  const [recurring, setRecurring] = useState(item?.recurring || false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>(item?.recurrenceFrequency || 'monthly');
  const [occurrences, setOccurrences] = useState<string>(''); // empty = indeterminado (1 ano)
  const [installments, setInstallments] = useState(1);
  const [useInstallments, setUseInstallments] = useState(false);
  const [inputMode, setInputMode] = useState<'total' | 'installment'>('total');
  const [installmentValue, setInstallmentValue] = useState('');
  const [paymentMode, setPaymentMode] = useState<'credit' | 'debit'>('credit');

  const selectedAccount = accounts.find(a => a.id === accountId);
  const isCreditCard = selectedAccount?.type?.includes('credit_card') ?? false;
  const hasDebitOption = isCreditCard && (selectedAccount?.type?.includes('checking') || selectedAccount?.type?.includes('cash'));
  const installmentAmount = amount ? (parseFloat(amount) / installments) : 0;

  // Auto-calculate due date from card billing cycle when in credit mode
  const calcDueDate = useCallback((pDate: string, acc: typeof selectedAccount) => {
    if (!pDate || !acc?.type?.includes('credit_card') || !acc.billingCloseDay || !acc.dueDay) return '';
    const purchase = new Date(pDate + 'T12:00:00');
    const closeDay = acc.billingCloseDay;
    const dDay = acc.dueDay;
    // Before close day: current month's invoice (due in current month)
    // After close day: next month's invoice (due in next month)
    let dueMonth = purchase.getMonth(); // 0-based
    let dueYear = purchase.getFullYear();
    if (purchase.getDate() > closeDay) {
      dueMonth += 1;
      if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
    }
    // If close day >= due day, the due date falls in the next month
    if (closeDay >= dDay) {
      dueMonth += 1;
      if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
    }
    const lastDay = new Date(dueYear, dueMonth + 1, 0).getDate();
    const finalDay = Math.min(dDay, lastDay);
    return `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
  }, []);

  // Reset payment mode when account changes
  const handleAccountChange = (v: string) => {
    setAccountId(v);
    const acc = accounts.find(a => a.id === v);
    const isCC = acc?.type?.includes('credit_card');
    if (!isCC) {
      setUseInstallments(false);
      setInstallments(1);
      setPaymentMode('debit');
    } else {
      setPaymentMode('credit');
      // Auto-calc due date from purchase date
      const calculated = calcDueDate(purchaseDate, acc);
      if (calculated) setDueDate(calculated);
    }
  };

  // When purchase date changes, recalculate due date for credit
  const handlePurchaseDateChange = (val: string) => {
    setPurchaseDate(val);
    if (isCreditCard && paymentMode === 'credit') {
      const calculated = calcDueDate(val, selectedAccount);
      if (calculated) setDueDate(calculated);
    }
  };

  return (
    <div className="space-y-4">
      <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição da conta" /></div>
      <div><Label>Fornecedor</Label><ContactAutocomplete value={supplier} onChange={setSupplier} placeholder="Nome do fornecedor" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Categoria</Label>
          <Select value={categoryId || undefined} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Conta</Label>
          <Select value={accountId || undefined} onValueChange={handleAccountChange}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Payment mode selector for credit card accounts */}
      {isCreditCard && (
        <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Label className="text-sm font-medium">Forma de Pagamento</Label>
          <div className="flex gap-2">
            <Button type="button" variant={paymentMode === 'credit' ? 'default' : 'outline'} size="sm"
              onClick={() => setPaymentMode('credit')} className="flex-1">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Crédito
            </Button>
            {hasDebitOption && (
              <Button type="button" variant={paymentMode === 'debit' ? 'default' : 'outline'} size="sm"
                onClick={() => { setPaymentMode('debit'); setUseInstallments(false); setInstallments(1); }} className="flex-1">
                <Wallet className="h-3.5 w-3.5 mr-1.5" />
                Débito
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div><Label>Valor Total</Label><CalculatorInput value={amount} onChange={setAmount} /></div>
        {isCreditCard && paymentMode === 'credit' ? (
          <div><Label>Data da Compra</Label><Input type="date" value={purchaseDate} onChange={e => handlePurchaseDateChange(e.target.value)} /></div>
        ) : (
          <div><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        )}
      </div>
      {isCreditCard && paymentMode === 'credit' && dueDate && (
        <p className="text-xs text-muted-foreground -mt-2">
          Vencimento da fatura: <strong className="text-foreground">{fmtDate(dueDate)}</strong>
        </p>
      )}

      {/* Installment option - only for credit mode */}
      {isCreditCard && paymentMode === 'credit' && (
        <div className="space-y-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Checkbox id="useInstallments" checked={useInstallments} onCheckedChange={(c) => { setUseInstallments(c === true); if (!c) setInstallments(1); }} />
            <Label htmlFor="useInstallments" className="cursor-pointer flex items-center gap-1.5">
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
      )}

      {/* Non-credit-card installment option */}
      {!isCreditCard && (
        <div className="space-y-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Checkbox id="useInstallments" checked={useInstallments} onCheckedChange={(c) => { setUseInstallments(c === true); if (!c) setInstallments(1); }} />
            <Label htmlFor="useInstallments" className="cursor-pointer flex items-center gap-1.5">
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
      )}

      {!useInstallments && (
        <div className="space-y-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Checkbox id="recurring" checked={recurring} onCheckedChange={(c) => setRecurring(c === true)} />
            <Label htmlFor="recurring" className="cursor-pointer flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              Conta recorrente
            </Label>
          </div>
          {recurring && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequência</Label>
                <Select value={recurrenceFrequency} onValueChange={v => setRecurrenceFrequency(v as RecurrenceFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nº de ocorrências</Label>
                <Input type="number" min="1" max="120" placeholder="Indeterminado (1 ano)" value={occurrences}
                  onChange={e => setOccurrences(e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Vazio = 1 ano ({recurrenceFrequency === 'weekly' ? '52 semanas' : recurrenceFrequency === 'monthly' ? '12 meses' : '1 ano'})
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div><Label>Notas (opcional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <Button className="w-full" disabled={!description || !supplier || !categoryId || !amount || (isCreditCard && paymentMode === 'credit' ? !purchaseDate : !dueDate)}
        onClick={() => {
          const isCredit = isCreditCard && paymentMode === 'credit';
          const finalDueDate = isCredit && !dueDate ? purchaseDate : dueDate;
          const isRecurring = !useInstallments && recurring;
          let recurrencePayload: { frequency: RecurrenceFrequency; occurrences: number } | undefined;
          if (isRecurring) {
            const parsed = parseInt(occurrences);
            const occ = (!occurrences || isNaN(parsed) || parsed < 1)
              ? (recurrenceFrequency === 'weekly' ? 52 : recurrenceFrequency === 'monthly' ? 12 : 1)
              : Math.min(120, parsed);
            recurrencePayload = { frequency: recurrenceFrequency, occurrences: occ };
          }
          onSave({
            description, supplier, categoryId, accountId: accountId || undefined, amount: parseFloat(amount),
            dueDate: finalDueDate, purchaseDate: isCredit ? purchaseDate : undefined,
            status: item?.status || 'pending', notes: notes || undefined,
            recurring: isRecurring || undefined,
            recurrenceFrequency: isRecurring ? recurrenceFrequency : undefined,
            installments: (useInstallments && installments > 1) ? installments : undefined,
            isCredit,
            recurrence: recurrencePayload,
          });
        }}>
        {item ? 'Atualizar' : 'Criar'} Conta
      </Button>
    </div>
  );
}
