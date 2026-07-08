import { useState, useCallback, useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import { supabase } from '@/integrations/supabase/client';
import { Payable, PayableStatus, RecurrenceFrequency } from '@/lib/types';
import { Plus, Trash2, Edit2, CheckCircle, RefreshCw, CreditCard, Wallet, ChevronDown, ChevronRight, CalendarIcon, X, Users } from 'lucide-react';
import { CalculatorInput } from '@/components/CalculatorInput';
import { ContactAutocomplete } from '@/components/ContactAutocomplete';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
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
import { MonthYearPicker } from '@/components/MonthYearPicker';
import { motion } from 'framer-motion';
import { fmt, fmtDate } from '@/lib/format';
import { SAFE_LABELS } from '@/lib/safe-labels';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, removeAccents } from '@/lib/utils';
import { toast } from 'sonner';

const statusLabels: Record<PayableStatus, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencida' };

function StatusBadge({ status }: { status: PayableStatus }) {
  const cls = status === 'paid' ? 'status-badge-paid' : status === 'overdue' ? 'status-badge-overdue text-destructive font-semibold' : 'status-badge-pending';
  return <span className={cls}>{statusLabels[status]}</span>;
}

function CreditCardInvoiceCard({ accName, accColor, invoicesByMonth, onMarkPaid, onPayAll, onDelete, onEdit }: {
  accName: string;
  accColor?: string;
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
    <div
      className="finance-card p-0 overflow-hidden border-l-4"
      style={accColor ? { borderLeftColor: accColor } : undefined}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted/40 transition-colors cursor-pointer"
        style={accColor ? { backgroundColor: `${accColor}1A` } : undefined}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" style={accColor ? { color: accColor } : undefined} /> : <ChevronRight className="h-4 w-4" style={accColor ? { color: accColor } : undefined} />}
          <CreditCard className="h-4 w-4" style={accColor ? { color: accColor } : undefined} />
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
            const monthTotal = items.reduce((s, i) => s + i.amount, 0);
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
  // Inicia recolhido — usuário expande para ver as compras da fatura
  const [open, setOpen] = useState(false);
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

function SupplierGroupTable({ supplierName, items, getCategoryName, getAccountName, selectedIds, toggleSelect, setSelectedIds, handleMarkPaid, setEditingItem, setDialogOpen, setDeleteId }: any) {
  const [open, setOpen] = useState(true);
  const totalAmount = items.reduce((s: number, p: any) => s + p.amount, 0);
  const allItemsSelected = items.length > 0 && items.filter((p: any) => p.status !== 'paid').every((p: any) => selectedIds.has(p.id));

  return (
    <div className="finance-card p-0 overflow-hidden border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors border-b border-border cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold">{supplierName}</span>
          <span className="text-xs text-muted-foreground">({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
        </div>
        <span className="text-sm mono font-semibold text-destructive">{fmt(totalAmount)}</span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 py-3 px-3">
                  <Checkbox 
                    checked={allItemsSelected && items.filter((p: any) => p.status !== 'paid').length > 0} 
                    onCheckedChange={() => {
                      const pendingItems = items.filter((p: any) => p.status !== 'paid');
                      if (pendingItems.length === 0) return;
                      if (allItemsSelected) {
                        setSelectedIds((prev: any) => {
                          const next = new Set(prev);
                          pendingItems.forEach((p: any) => next.delete(p.id));
                          return next;
                        });
                      } else {
                        setSelectedIds((prev: any) => {
                          const next = new Set(prev);
                          pendingItems.forEach((p: any) => next.add(p.id));
                          return next;
                        });
                      }
                    }} 
                    aria-label="Selecionar todos" 
                    disabled={items.filter((p: any) => p.status !== 'paid').length === 0} 
                  />
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vencimento</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descrição</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Categoria</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Conta</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p: any) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3">
                    {p.status !== 'paid' && (
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} aria-label="Selecionar" />
                    )}
                  </td>
                  <td className="py-3 px-4 mono text-muted-foreground">{fmtDate(p.dueDate)}</td>
                  <td className={`py-3 px-4 font-medium ${p.status === 'overdue' ? 'text-destructive' : p.status === 'paid' ? 'text-success' : 'text-warning'}`}>
                    <div className="flex items-center gap-1.5">
                      {p.description}
                      {p.recurring && <RefreshCw className="h-3 w-3 text-primary" />}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{getCategoryName(p.categoryId)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.accountId ? getAccountName(p.accountId) : '—'}</td>
                  <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                  <td className="py-3 px-4 text-right mono font-semibold text-destructive">{fmt(p.amount)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status !== 'paid' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={(e) => { e.stopPropagation(); handleMarkPaid(p.id); }}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingItem(p); setDialogOpen(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
  const { data, addPayable, updatePayable, updatePayableWithFuture, deletePayable, deletePayableWithFuture, markPayablePaid, markPayablePaidPartial, getCategoryName, getAccountName, insertGroupedTransaction } = useFinance();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending_overdue');
  const [editingItem, setEditingItem] = useState<Payable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'contact' | 'date'>('contact');
  const [updateFuturePayload, setUpdateFuturePayload] = useState<Payable | null>(null);
  const [updateFutureTarget, setUpdateFutureTarget] = useState<Payable | null>(null);
  const [updateFutureCount, setUpdateFutureCount] = useState<number>(0);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAccountId, setPayAccountId] = useState('');
  const [partialMode, setPartialMode] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [interestPercent, setInterestPercent] = useState('');
  const [payDiscountAmount, setPayDiscountAmount] = useState('');
  const [payDiscountType, setPayDiscountType] = useState<'BRL' | 'PERCENT'>('BRL');
  const [showPayItems, setShowPayItems] = useState(false);
  const [showMorePayOptions, setShowMorePayOptions] = useState(false);
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

  const normalizedSearch = removeAccents(search.toLowerCase());
  const allFiltered = data.payables
    .filter(p => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending_overdue') return p.status === 'pending' || p.status === 'overdue';
      return p.status === statusFilter;
    })
    .filter(p => removeAccents(p.description.toLowerCase()).includes(normalizedSearch) || removeAccents(p.supplier.toLowerCase()).includes(normalizedSearch))
    .filter(p => {
      if (dateFrom && p.dueDate < format(dateFrom, 'yyyy-MM-dd')) return false;
      if (dateTo && p.dueDate > format(dateTo, 'yyyy-MM-dd')) return false;
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Lista única de fornecedores para sugestões de busca (exclui faturas de cartão internas)
  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    data.payables.forEach(p => {
      if (p.supplier && !p.supplier.startsWith('cartao:')) set.add(p.supplier);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data.payables]);

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
    setInterestPercent('');
    setPayDiscountAmount('');
    setPayDiscountType('BRL');
    setShowPayItems(false);
    setShowMorePayOptions(false);
    setPayDialogOpen(true);
  };

  const handlePayAll = (ids: string[]) => {
    const first = data.payables.find(p => p.id === ids[0]);
    setPayingIds(ids);
    setPayAccountId(first?.accountId || data.accounts[0]?.id || '');
    setPartialMode(false);
    setPartialAmount('');
    setInterestPercent('');
    setPayDiscountAmount('');
    setPayDiscountType('BRL');
    setShowPayItems(false);
    setShowMorePayOptions(false);
    setPayDialogOpen(true);
  };

  const handlePaySelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    handlePayAll(ids);
  };

  const confirmPay = async () => {
    if (payingIds.length > 0 && payAccountId) {
      const itemsToPay = payingIds.map(id => data.payables.find(x => x.id === id)).filter(Boolean) as Payable[];
      const isInvoice = itemsToPay.length > 0 && itemsToPay.every(p => p.supplier?.startsWith('cartao:'));
      
      const baseTotal = itemsToPay.reduce((sum, p) => sum + p.amount, 0);
      const discountAmount = payDiscountType === 'PERCENT'
        ? baseTotal * (parseFloat(payDiscountAmount) || 0) / 100
        : (parseFloat(payDiscountAmount) || 0);
      const interestAmount = baseTotal > 0 ? (baseTotal * (parseFloat(interestPercent) || 0) / 100) : 0;
      
      let totalActuallyPaid = 0;

      if (partialMode) {
        const amt = parseFloat(partialAmount);
        if (!amt || amt <= 0) return;
        totalActuallyPaid = amt;

        if (payingIds.length === 1) {
          await markPayablePaidPartial(payingIds[0], payAccountId, amt, isInvoice, interestAmount, discountAmount);
        } else {
          // FIFO: paga itens mais antigos primeiro até esgotar o valor
          const items = itemsToPay.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
          const totalDue = baseTotal + interestAmount - discountAmount;
          if (totalDue <= 0) return;
          
          if (amt >= totalDue) {
            for (const p of items) {
              const pRatio = baseTotal > 0 ? p.amount / baseTotal : 0;
              await markPayablePaid(p.id, payAccountId, isInvoice, interestAmount * pRatio, discountAmount * pRatio);
            }
          } else {
            let remaining = amt;
            for (const p of items) {
              if (remaining <= 0) break;
              const pRatio = baseTotal > 0 ? p.amount / baseTotal : 0;
              const pInterest = interestAmount * pRatio;
              const pDiscount = discountAmount * pRatio;
              const pTotalDue = p.amount + pInterest - pDiscount;
              
              if (remaining >= pTotalDue - 0.005) {
                // quita integralmente este item
                await markPayablePaid(p.id, payAccountId, isInvoice, pInterest, pDiscount);
                remaining = Math.round((remaining - pTotalDue) * 100) / 100;
              } else {
                // pagamento parcial deste item — gera saldo restante individual
                await markPayablePaidPartial(p.id, payAccountId, Math.round(remaining * 100) / 100, isInvoice, pInterest, pDiscount);
                remaining = 0;
              }
            }
          }
        }
      } else {
        totalActuallyPaid = itemsToPay.reduce((s, p) => s + p.amount, 0);

        for (const id of payingIds) {
          const p = data.payables.find(x => x.id === id);
          if (!p) continue;
          const ratio = baseTotal > 0 ? p.amount / baseTotal : 0;
          const itemInterest = interestAmount * ratio;
          const itemDiscount = discountAmount * ratio;
          await markPayablePaid(id, payAccountId, isInvoice, itemInterest, itemDiscount);
        }
      }

      if (isInvoice && totalActuallyPaid > 0) {
        const creditCardAccountId = itemsToPay[0].supplier.replace('cartao:', '');
        const cardName = getAccountName(creditCardAccountId) || 'Cartão de Crédito';
        
        await insertGroupedTransaction({
          type: 'expense',
          description: `Fatura ${cardName}`,
          categoryId: itemsToPay[0].categoryId,
          amount: totalActuallyPaid,
          date: new Date().toISOString().split('T')[0],
          accountId: payAccountId,
          notes: 'Pagamento de Fatura',
        });
      }

      setPayDialogOpen(false);
      setSelectedIds(new Set());
      setPayingIds([]);
      setPartialMode(false);
      setPartialAmount('');
      setInterestPercent('');
      setPayDiscountAmount('');
      setPayDiscountType('BRL');
    }
  };

  const payingTotal = payingIds.reduce((sum, id) => {
    const p = data.payables.find(x => x.id === id);
    return sum + (p?.amount || 0);
  }, 0);
  const interestAmount = payingTotal * (parseFloat(interestPercent) || 0) / 100;
  const calculatedDiscount = payDiscountType === 'PERCENT'
    ? payingTotal * (parseFloat(payDiscountAmount) || 0) / 100
    : (parseFloat(payDiscountAmount) || 0);
  const finalPayingTotal = Math.max(0, payingTotal + interestAmount - calculatedDiscount);
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
          <DialogContent 
            className="max-h-[90vh] overflow-y-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Nova'} {SAFE_LABELS.payable}</DialogTitle></DialogHeader>
            <PayableForm item={editingItem} categories={data.categories.filter(c => c.type === 'expense')} accounts={data.accounts}
              onSave={(p) => {
                const { installments, isCredit, recurrence, ...payable } = p;
                if (editingItem) {
                  const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase();
                  const baseDesc = stripSuffix(editingItem.description);
                  const isLinked = editingItem.recurring || /\(\d+\/\d+\)\s*$/.test(editingItem.description);
                  const linkedFuture = isLinked
                    ? data.payables.filter(x =>
                        x.id !== editingItem.id &&
                        (x.recurring || /\(\d+\/\d+\)\s*$/.test(x.description)) &&
                        x.supplier === editingItem.supplier &&
                        x.categoryId === editingItem.categoryId &&
                        x.dueDate >= editingItem.dueDate &&
                        stripSuffix(x.description) === baseDesc &&
                        x.status !== 'paid'
                      )
                    : [];
                  if (linkedFuture.length > 0) {
                    setUpdateFuturePayload(payable as Payable);
                    setUpdateFutureTarget(editingItem);
                    setUpdateFutureCount(linkedFuture.length);
                    setDialogOpen(false);
                    setEditingItem(null);
                  } else {
                    updatePayable({ ...payable, id: editingItem.id } as Payable);
                    setDialogOpen(false);
                    setEditingItem(null);
                  }
                } else {
                  addPayable(payable, installments, isCredit, recurrence);
                  setDialogOpen(false);
                  setEditingItem(null);
                }
              }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <SearchAutocomplete
          value={search}
          onChange={setSearch}
          options={supplierOptions}
          placeholder="Buscar fornecedor ou descrição..."
          className="flex-1 min-w-[200px]"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending_overdue">Pendente/Atrasado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Atrasado</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center bg-muted/50 p-1 rounded-md border border-border ml-auto sm:ml-0">
          <button
            onClick={() => setGroupBy('contact')}
            className={cn("p-1.5 rounded-sm transition-colors", groupBy === 'contact' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            title="Agrupar por Contato"
          >
            <Users className="h-4 w-4" />
          </button>
          <button
            onClick={() => setGroupBy('date')}
            className={cn("p-1.5 rounded-sm transition-colors", groupBy === 'date' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            title="Agrupar por Data"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <MonthYearPicker
          value={dateFrom && dateTo && format(dateFrom, 'yyyy-MM') === format(dateTo, 'yyyy-MM') ? dateFrom : undefined}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
          active={!!(dateFrom && dateTo && format(dateFrom, 'yyyy-MM') === format(new Date(), 'yyyy-MM') && format(dateTo, 'yyyy-MM') === format(new Date(), 'yyyy-MM'))}
        />
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
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 flex-1 sm:flex-none" onClick={handlePaySelected}>
              <CheckCircle className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Pagar selecionados</span>
            </Button>
          </div>
        )}
      </div>
      {(() => {
        let groups: Record<string, Payable[]> = {};
        
        if (groupBy === 'contact') {
          groups = regularPayables.reduce<Record<string, Payable[]>>((acc, p) => {
            const supplier = p.supplier?.startsWith('meta:') ? 'Meta/Sonhos' : (p.supplier || 'Outros');
            if (!acc[supplier]) acc[supplier] = [];
            acc[supplier].push(p);
            return acc;
          }, {});
        } else {
          groups = regularPayables.reduce<Record<string, Payable[]>>((acc, p) => {
            const dateKey = p.dueDate || 'Sem Data';
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(p);
            return acc;
          }, {});
        }
        
        const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

        if (sortedKeys.length === 0) {
          return (
            <div className="finance-card p-12 text-center text-muted-foreground">
              Nenhuma conta encontrada
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {sortedKeys.map(key => {
              const displayName = groupBy === 'date' ? (key === 'Sem Data' ? key : fmtDate(key)) : key;
              return (
                <SupplierGroupTable
                  key={key}
                  supplierName={displayName}
                  items={groups[key]}
                getCategoryName={getCategoryName}
                getAccountName={getAccountName}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                setSelectedIds={setSelectedIds}
                handleMarkPaid={handleMarkPaid}
                setEditingItem={setEditingItem}
                setDialogOpen={setDialogOpen}
                setDeleteId={setDeleteId}
              />
              );
            })}
          </div>
        );
      })()}

      {/* Credit Card Invoices Section */}
      {Object.keys(creditByAccount).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Faturas de Cartão de Crédito
          </h2>
          {Object.entries(creditByAccount).map(([accountId, invoices]) => {
            const accName = getAccountName(accountId);
            const accColor = data.accounts.find(a => a.id === accountId)?.color;
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
                accColor={accColor}
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
              <span className="text-sm text-muted-foreground">{payingIds.length > 1 ? `${payingIds.length} itens` : 'Valor'} original</span>
              <span className="text-lg font-bold text-muted-foreground mono">{fmt(payingTotal)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Juros (%)</Label>
                <Input type="number" step="0.1" min="0" value={interestPercent} onChange={(e) => setInterestPercent(e.target.value)} placeholder="0.0" />
              </div>
              <div className="space-y-2">
                <Label>Desconto</Label>
                <div className="flex gap-1">
                  <Input type="number" step="0.01" min="0" value={payDiscountAmount} onChange={(e) => setPayDiscountAmount(e.target.value)} placeholder="0,00" />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-12 shrink-0 font-bold"
                    onClick={() => setPayDiscountType(prev => prev === 'BRL' ? 'PERCENT' : 'BRL')}
                  >
                    {payDiscountType === 'BRL' ? 'R$' : '%'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md bg-primary/10 border border-primary/20">
              <span className="text-sm font-semibold text-primary">Valor a pagar</span>
              <span className="text-xl font-bold text-destructive mono">{fmt(finalPayingTotal)}</span>
            </div>
            {payingIds.length > 1 && (() => {
              const items = payingIds.map(id => data.payables.find(x => x.id === id)).filter(Boolean) as Payable[];
              return (
                <div className="rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPayItems(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {showPayItems ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      Ver descrição das contas ({items.length})
                    </span>
                  </button>
                  {showPayItems && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-border border-t border-border">
                      {items.map(it => (
                        <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                          <span className="text-muted-foreground mono whitespace-nowrap">{fmtDate(it.dueDate)}</span>
                          <span className="flex-1 truncate">{it.description}</span>
                          <span className="mono font-medium text-destructive whitespace-nowrap">{fmt(it.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
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
                  Saldo após pagamento: <span className="font-semibold mono">{fmt(selectedPayAccount.balance - (partialMode && partialAmount ? parseFloat(partialAmount) || 0 : finalPayingTotal))}</span>
                </p>
              )}
            </div>
            {(() => {
              const recItems = payingIds.map(id => data.payables.find(x => x.id === id)).filter(Boolean) as Payable[];
              const sameSupplier = recItems.length > 0 && recItems.every(p => p.supplier === recItems[0].supplier);
              const allowPartial = recItems.length === 1 || (recItems.length > 1 && sameSupplier);
              const isInvoice = recItems.length > 1 && recItems.every(p => p.supplier?.startsWith('cartao:'));
              if (!allowPartial) return null;
              const partialBlock = (
              <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Checkbox id="partialPay" checked={partialMode} onCheckedChange={(c) => {
                    const checked = c === true;
                    setPartialMode(checked);
                    if (checked && !partialAmount) setPartialAmount((finalPayingTotal / 2).toFixed(2));
                    if (!checked) setPartialAmount('');
                  }} />
                  <Label htmlFor="partialPay" className="cursor-pointer text-sm">
                    Pagamento parcial{recItems.length > 1 ? ` (${recItems.length} itens)` : ''}
                  </Label>
                </div>
                {partialMode && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {recItems.length > 1 ? 'Valor pago agora (FIFO — quita os mais antigos primeiro)' : 'Valor pago agora'}
                    </Label>
                    <Input type="number" step="0.01" min="0.01" max={finalPayingTotal} value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)} placeholder="0,00" />
                    <p className="text-xs text-muted-foreground mt-1">O saldo restante de {fmt(Math.max(0, finalPayingTotal - (parseFloat(partialAmount) || 0)))} será criado como uma nova conta pendente.</p>
                    {partialAmount && parseFloat(partialAmount) > 0 && parseFloat(partialAmount) < finalPayingTotal && (
                      <p className="text-xs text-muted-foreground">
                        Saldo restante: <span className="font-semibold mono text-destructive">{fmt(finalPayingTotal - parseFloat(partialAmount))}</span> — {recItems.length > 1 ? `as contas mais antigas serão quitadas integralmente; a próxima ficará parcial com saldo restante individual.` : 'será criada uma nova conta pendente com os mesmos dados.'}
                      </p>
                    )}
                    {partialAmount && parseFloat(partialAmount) >= finalPayingTotal && (
                      <p className="text-xs text-warning">Valor igual ou maior que o total — será registrado como pagamento integral.</p>
                    )}
                  </div>
                )}
              </div>
              );
              if (isInvoice) {
                return (
                  <div className="rounded-md border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowMorePayOptions(v => !v)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
                    >
                      {showMorePayOptions ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      Mais opções de pagamento
                    </button>
                    {showMorePayOptions && (
                      <div className="p-3 border-t border-border">
                        {partialBlock}
                      </div>
                    )}
                  </div>
                );
              }
              return partialBlock;
            })()}
            <Button className="w-full" disabled={!payAccountId || (partialMode && (!partialAmount || parseFloat(partialAmount) <= 0))} onClick={confirmPay}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {partialMode ? 'Confirmar Pagamento Parcial' : 'Confirmar Pagamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {(() => {
        const target = deleteId ? data.payables.find(p => p.id === deleteId) : null;
        if (!target) {
          return (
            <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}
              onConfirm={() => { if (deleteId) { deletePayable(deleteId); setDeleteId(null); } }}
              title="Excluir conta a pagar?" description="Tem certeza que deseja excluir esta conta a pagar? Esta ação não pode ser desfeita." />
          );
        }
        const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase();
        const baseDesc = stripSuffix(target.description);
        const isLinked = target.recurring || /\(\d+\/\d+\)\s*$/.test(target.description);
        const linkedFuture = isLinked
          ? data.payables.filter(p =>
              p.id !== target.id &&
              (p.recurring || /\(\d+\/\d+\)\s*$/.test(p.description)) &&
              p.supplier === target.supplier &&
              p.categoryId === target.categoryId &&
              p.dueDate >= target.dueDate &&
              stripSuffix(p.description) === baseDesc &&
              p.status !== 'paid'
            )
          : [];
        const hasFuture = linkedFuture.length > 0;
        if (!hasFuture) {
          return (
            <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}
              onConfirm={() => { deletePayable(target.id); setDeleteId(null); }}
              title="Excluir conta a pagar?" description="Tem certeza que deseja excluir esta conta a pagar? Esta ação não pode ser desfeita." />
          );
        }
        return (
          <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir conta recorrente ou parcelada?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta conta faz parte de uma série recorrente ou parcelada. Existem <strong>{linkedFuture.length}</strong> ocorrência(s) futura(s) pendente(s) vinculada(s). O que deseja excluir?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  onClick={() => { deletePayable(target.id); setDeleteId(null); }}
                >
                  Apenas esta
                </AlertDialogAction>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    const n = await deletePayableWithFuture(target.id);
                    setDeleteId(null);
                    if (n > 1) toast.success(`${n} contas vinculadas excluídas`);
                  }}
                >
                  Esta e {linkedFuture.length} futura(s)
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      <AlertDialog open={!!updateFutureTarget} onOpenChange={(o) => { if (!o) { setUpdateFutureTarget(null); setUpdateFuturePayload(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar conta vinculada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta conta faz parte de uma série recorrente ou parcelada. Existem <strong>{updateFutureCount}</strong> ocorrência(s) futura(s) pendente(s) vinculada(s). Deseja aplicar as alterações de fornecedor, categoria, valor e observações apenas nesta conta ou em todas as futuras também?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => {
                if (updateFuturePayload && updateFutureTarget) {
                  updatePayable({ ...updateFuturePayload, id: updateFutureTarget.id });
                }
                setUpdateFutureTarget(null);
                setUpdateFuturePayload(null);
              }}
            >
              Apenas esta
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={async () => {
                if (updateFuturePayload && updateFutureTarget) {
                  const n = await updatePayableWithFuture({ ...updateFuturePayload, id: updateFutureTarget.id });
                  if (n > 1) toast.success(`${n} contas vinculadas alteradas`);
                }
                setUpdateFutureTarget(null);
                setUpdateFuturePayload(null);
              }}
            >
              Esta e {updateFutureCount} futura(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [paymentMode, setPaymentMode] = useState<'credit' | 'debit'>(() => {
    const initialAcc = accounts.find(a => a.id === (item?.accountId || ''));
    const isCC = initialAcc?.type?.includes('credit_card');
    const canDebit = initialAcc?.type?.includes('checking') || initialAcc?.type?.includes('cash');
    return isCC && canDebit ? 'debit' : 'credit';
  });

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
    if (purchase.getDate() >= closeDay) {
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
      const canDebit = acc?.type?.includes('checking') || acc?.type?.includes('cash');
      setPaymentMode(canDebit ? 'debit' : 'credit');
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
