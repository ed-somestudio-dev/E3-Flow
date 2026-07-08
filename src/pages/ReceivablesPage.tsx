import { useState, useMemo, useEffect } from 'react';
import { useFinance } from '@/lib/finance-context';
import { supabase } from '@/integrations/supabase/client';
import { usePixSettings } from '@/lib/pix-settings-context';
import { Receivable, ReceivableStatus, RecurrenceFrequency } from '@/lib/types';
import { Plus, Trash2, Edit2, CheckCircle, CreditCard, CalendarIcon, X, RefreshCw, QrCode, Receipt, AlertTriangle, ChevronDown, ChevronRight, Upload, MessageCircle, FileText, Users } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { CalculatorInput } from '@/components/CalculatorInput';
import { ContactAutocomplete } from '@/components/ContactAutocomplete';
import { useContacts } from '@/lib/contacts-context';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { ShareDocumentDialog } from '@/components/ShareDocumentDialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
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
import { Link } from 'react-router-dom';
import {
  generateChargePDF, generateChargePNG, generateChargesPDF,
  generateReceiptPDF, generateReceiptPNG, generateReceivablesReportPDF, generateReceivablesReportPNG
} from '@/lib/documents';
import { toast } from 'sonner';

const statusLabels: Record<ReceivableStatus, string> = { pending: 'Pendente', received: 'Recebido', overdue: 'Atrasado' };

function StatusBadge({ status }: { status: ReceivableStatus }) {
  const cls = status === 'received' ? 'status-badge-paid' : status === 'overdue' ? 'status-badge-overdue' : 'status-badge-pending';
  return <span className={cls}>{statusLabels[status]}</span>;
}

function ClientGroupTable({ clientName, items, getCategoryName, getAccountName, selectedIds, toggleSelect, setSelectedIds, handleMarkReceived, handleGenerateCharge, handleWhatsAppReminder, handleShareReceipt, setEditingItem, setDialogOpen, setDeleteId, pixSettings }: any) {
  const [open, setOpen] = useState(true);
  const totalAmount = items.reduce((s: number, p: any) => s + p.amount, 0);
  const allItemsSelected = items.length > 0 && items.filter((p: any) => p.status !== 'received').every((p: any) => selectedIds.has(p.id));

  return (
    <div className="finance-card p-0 overflow-hidden border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors border-b border-border cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-semibold">{clientName}</span>
          <span className="text-xs text-muted-foreground">({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
        </div>
        <span className="text-sm mono font-semibold text-success">{fmt(totalAmount)}</span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 py-3 px-3">
                  <Checkbox 
                    checked={allItemsSelected && items.filter((p: any) => p.status !== 'received').length > 0} 
                    onCheckedChange={() => {
                      const pendingItems = items.filter((p: any) => p.status !== 'received');
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
                    disabled={items.filter((p: any) => p.status !== 'received').length === 0} 
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
              {items.map((r: any) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3">
                    {r.status !== 'received' && (
                      <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} aria-label="Selecionar" />
                    )}
                  </td>
                  <td className="py-3 px-4 mono text-muted-foreground">{fmtDate(r.dueDate)}</td>
                  <td className={r.status === 'overdue' ? 'py-3 px-4 text-destructive' : r.status === 'received' ? 'py-3 px-4 text-success' : 'py-3 px-4 text-warning'}>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={(e) => { e.stopPropagation(); handleGenerateCharge(r); }} title="Gerar boleto PIX">
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600" onClick={(e) => { e.stopPropagation(); handleWhatsAppReminder(r); }} title="Enviar cobrança via WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={(e) => { e.stopPropagation(); handleMarkReceived(r.id); }} title="Marcar como recebido">
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {r.status === 'received' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={(e) => { e.stopPropagation(); handleShareReceipt(r); }} title="Compartilhar recibo">
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingItem(r); setDialogOpen(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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

export default function ReceivablesPage() {
  const { data, addReceivable, updateReceivable, updateReceivableWithFuture, deleteReceivable, deleteReceivableWithFuture, markReceivableReceived, markReceivableReceivedPartial, getCategoryName, getAccountName } = useFinance();
  const { settings: pixSettings, isConfigured } = usePixSettings();
  const { contacts } = useContacts();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending_overdue');
  const [editingItem, setEditingItem] = useState<Receivable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'contact' | 'date'>('contact');
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receivingIds, setReceivingIds] = useState<string[]>([]);
  const [receiveAccountId, setReceiveAccountId] = useState('');
  const [partialMode, setPartialMode] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [interestPercent, setInterestPercent] = useState('');
  const [receiveDiscountAmount, setReceiveDiscountAmount] = useState('');
  const [receiveDiscountType, setReceiveDiscountType] = useState<'BRL' | 'PERCENT'>('BRL');
  const [showReceiveItems, setShowReceiveItems] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(new Date()));
  const [showPastOverdue, setShowPastOverdue] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pixWarningOpen, setPixWarningOpen] = useState(false);
  const [bulkPartialMode, setBulkPartialMode] = useState(false);
  const [bulkPartialAmount, setBulkPartialAmount] = useState('');
  const [updateFuturePayload, setUpdateFuturePayload] = useState<Receivable | null>(null);
  const [updateFutureTarget, setUpdateFutureTarget] = useState<Receivable | null>(null);
  const [updateFutureCount, setUpdateFutureCount] = useState<number>(0);

  // OFX reconciliation states
  const [ofxDialogOpen, setOfxDialogOpen] = useState(false);
  const [ofxTransactions, setOfxTransactions] = useState<any[]>([]);
  const [selectedOfxAccountId, setSelectedOfxAccountId] = useState('');
  const [ofxStep, setOfxStep] = useState<'upload' | 'reconcile' | 'success'>('upload');
  const [reconciliations, setReconciliations] = useState<Record<string, string>>({}); // ofxTxId -> receivableId (or 'ignore')
  const [isProcessingOfx, setIsProcessingOfx] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Auto-select first account when opening OFX modal
  useEffect(() => {
    if (ofxDialogOpen && data.accounts.length > 0 && !selectedOfxAccountId) {
      setSelectedOfxAccountId(data.accounts[0].id);
    }
  }, [ofxDialogOpen, data.accounts, selectedOfxAccountId]);

  const handleOfxFile = async (file: File) => {
    try {
      const text = await file.text();
      const { parseOFX, getMatchCandidates } = await import('@/lib/ofx-parser');
      const allTx = parseOFX(text);
      
      // Filter only CREDIT (inflows) with positive amount
      const credits = allTx.filter(tx => tx.type === 'CREDIT' && tx.amount > 0);
      
      if (credits.length === 0) {
        toast.error('Nenhuma transação de crédito (entrada) foi encontrada no arquivo OFX.');
        return;
      }
      
      const enrichedCredits = credits.map(tx => {
        const candidates = getMatchCandidates(tx, data.receivables);
        return {
          ...tx,
          candidates
        };
      });
      
      const initialReconciliations: Record<string, string> = {};
      enrichedCredits.forEach(tx => {
        const best = tx.candidates[0];
        if (best && best.score >= 100) {
          initialReconciliations[tx.id] = best.receivable.id;
        } else {
          initialReconciliations[tx.id] = 'ignore';
        }
      });
      
      setOfxTransactions(enrichedCredits);
      setReconciliations(initialReconciliations);
      setOfxStep('reconcile');
      toast.success(`${credits.length} transações de entrada identificadas.`);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao processar arquivo OFX. Verifique se o formato está correto.');
    }
  };

  const confirmOfxReconciliation = async () => {
    if (!selectedOfxAccountId) {
      toast.error('Selecione uma conta bancária.');
      return;
    }
    
    setIsProcessingOfx(true);
    let count = 0;
    
    try {
      const entries = Object.entries(reconciliations);
      for (const [txId, recId] of entries) {
        if (recId && recId !== 'ignore') {
          const tx = ofxTransactions.find(t => t.id === txId);
          if (tx) {
            await markReceivableReceived(recId, selectedOfxAccountId, tx.date);
            count++;
          }
        }
      }
      
      toast.success(`${count} recebíveis conciliados com sucesso.`);
      setOfxStep('success');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao processar conciliação.');
    } finally {
      setIsProcessingOfx(false);
    }
  };

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

  const normalizedSearch = removeAccents(search.toLowerCase());
  const filtered = data.receivables
    .filter(r => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending_overdue') return r.status === 'pending' || r.status === 'overdue';
      return r.status === statusFilter;
    })
    .filter(r => removeAccents(r.description.toLowerCase()).includes(normalizedSearch) || removeAccents(r.clientName.toLowerCase()).includes(normalizedSearch))
    .filter(r => {
      const isPastOverdue = r.status === 'overdue' && dateFrom && r.dueDate < format(dateFrom, 'yyyy-MM-dd');
      if (isPastOverdue && showPastOverdue) return true;

      if (dateFrom && r.dueDate < format(dateFrom, 'yyyy-MM-dd')) return false;
      if (dateTo && r.dueDate > format(dateTo, 'yyyy-MM-dd')) return false;
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const clientOptions = useMemo(() => {
    const set = new Set<string>();
    data.receivables.forEach(r => { if (r.clientName) set.add(r.clientName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data.receivables]);

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
    setInterestPercent('');
    setReceiveDiscountAmount('');
    setReceiveDiscountType('BRL');
    setShowReceiveItems(false);
    setReceiveDialogOpen(true);
  };

  const handleReceiveSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const first = data.receivables.find(r => r.id === ids[0]);
    setReceivingIds(ids);
    setReceiveAccountId(first?.accountId || data.accounts[0]?.id || '');
    // Se o modo parcial da barra estiver ativo, já preenche o dialog
    if (bulkPartialMode && bulkPartialAmount) {
      setPartialMode(true);
      setPartialAmount(bulkPartialAmount);
    } else {
      setPartialMode(false);
      setPartialAmount('');
    }
    setInterestPercent('');
    setReceiveDiscountAmount('');
    setReceiveDiscountType('BRL');
    setShowReceiveItems(false);
    setReceiveDialogOpen(true);
  };

  const confirmReceive = async () => {
    if (receivingIds.length === 0 || !receiveAccountId) return;
    const accName = data.accounts.find(a => a.id === receiveAccountId)?.name || '';
    const items = receivingIds.map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
    
    const baseTotal = items.reduce((sum, r) => sum + r.amount, 0);
    const discountAmount = receiveDiscountType === 'PERCENT'
      ? baseTotal * (parseFloat(receiveDiscountAmount) || 0) / 100
      : (parseFloat(receiveDiscountAmount) || 0);
    const interestAmount = baseTotal > 0 ? (baseTotal * (parseFloat(interestPercent) || 0) / 100) : 0;
    
    let partialAmtUsed = 0;
    if (partialMode) {
      const amt = parseFloat(partialAmount);
      if (!amt || amt <= 0) return;
      partialAmtUsed = amt;
      if (receivingIds.length === 1) {
        await markReceivableReceivedPartial(receivingIds[0], receiveAccountId, amt, interestAmount, discountAmount);
      } else {
        // FIFO: quita os mais antigos primeiro até esgotar o valor recebido
        const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const totalDue = baseTotal + interestAmount - discountAmount;
        if (totalDue <= 0) return;
        
        if (amt >= totalDue) {
          for (const r of sorted) {
             const rRatio = baseTotal > 0 ? r.amount / baseTotal : 0;
             await markReceivableReceived(r.id, receiveAccountId, undefined, interestAmount * rRatio, discountAmount * rRatio);
          }
        } else {
          let remaining = amt;
          for (const r of sorted) {
            if (remaining <= 0) break;
            const rRatio = baseTotal > 0 ? r.amount / baseTotal : 0;
            const rInterest = interestAmount * rRatio;
            const rDiscount = discountAmount * rRatio;
            const rTotalDue = r.amount + rInterest - rDiscount;
            
            if (remaining >= rTotalDue - 0.005) {
              await markReceivableReceived(r.id, receiveAccountId, undefined, rInterest, rDiscount);
              remaining = Math.round((remaining - rTotalDue) * 100) / 100;
            } else {
              await markReceivableReceivedPartial(r.id, receiveAccountId, Math.round(remaining * 100) / 100, rInterest, rDiscount);
              remaining = 0;
            }
          }
        }
      }
    } else {
      
      for (const id of receivingIds) {
        const r = data.receivables.find(x => x.id === id);
        if (!r) continue;
        const ratio = baseTotal > 0 ? r.amount / baseTotal : 0;
        const itemInterest = interestAmount * ratio;
        const itemDiscount = discountAmount * ratio;
        await markReceivableReceived(id, receiveAccountId, undefined, itemInterest, itemDiscount);
      }
    }
    setReceiveDialogOpen(false);
    setSelectedIds(new Set());
    setReceivingIds([]);
    const wasPartial = partialMode;
    const partialAmt = partialAmtUsed;
    setPartialMode(false);
    setPartialAmount('');
    setInterestPercent('');
    setReceiveDiscountAmount('');
    setReceiveDiscountType('BRL');

    // Sempre oferecer recibo após registrar o recebimento
    const today = format(new Date(), 'yyyy-MM-dd');
    if (items.length === 1) {
      const r = items[0];
      const isPartial = wasPartial && partialAmt > 0 && partialAmt < r.amount;
      const baseReceivedAmt = wasPartial && partialAmt > 0 ? Math.min(partialAmt, r.amount) : r.amount;
      const finalAmt = baseReceivedAmt + interestAmount - discountAmount;
      openShare({
        title: isPartial ? 'Compartilhar Recibo (Parcial)' : 'Compartilhar Recibo',
        filenameBase: `${isPartial ? 'recibo-parcial' : 'recibo'}-${r.clientName.replace(/\s+/g, '_')}-${today}`,
        generatePDF: () => generateReceiptPDF({
          id: r.id, clientName: r.clientName,
          description: isPartial ? `${r.description} (parcial)` : r.description,
          amount: finalAmt, receivedDate: today, accountName: accName,
          interestAmount, discountAmount
        }, pixSettings),
        generatePNG: () => generateReceiptPNG({
          id: r.id, clientName: r.clientName,
          description: isPartial ? `${r.description} (parcial)` : r.description,
          amount: finalAmt, receivedDate: today, accountName: accName,
          interestAmount, discountAmount
        }, pixSettings),
      });
    } else if (items.length > 1) {
      // Aggregated receipt
      const total = items.reduce((s, r) => s + r.amount, 0);
      // Se foi recebimento parcial em lote, usa o valor efetivamente recebido (não o total das contas)
      const baseReceivedAmount = wasPartial && partialAmt > 0 ? Math.min(partialAmt, total) : total;
      const finalReceivedAmount = baseReceivedAmount + interestAmount - discountAmount;
      const isPartial = wasPartial && baseReceivedAmount < total;
      const isSameClient = items.every(i => (i.clientName || '').trim().toLowerCase() === (items[0].clientName || '').trim().toLowerCase());
      const clientName = isSameClient ? items[0].clientName : 'Diversos';
      const baseDesc = `${items.length} recebimentos: ` + items.map(i => i.description).join(', ');
      const description = isPartial
        ? `${baseDesc} (parcial — saldo restante: ${(total - baseReceivedAmount).toFixed(2)})`
        : baseDesc;
      openShare({
        title: isPartial ? 'Compartilhar Recibo (Parcial)' : 'Compartilhar Recibo',
        filenameBase: `${isPartial ? 'recibo-parcial-multiplo' : 'recibo-multiplo'}-${today}`,
        generatePDF: () => generateReceiptPDF({
          id: items[0].id, clientName, description,
          amount: finalReceivedAmount, receivedDate: today, accountName: accName,
          interestAmount, discountAmount
        }, pixSettings),
        generatePNG: () => generateReceiptPNG({
          id: items[0].id, clientName, description,
          amount: finalReceivedAmount, receivedDate: today, accountName: accName,
          interestAmount, discountAmount
        }, pixSettings),
      });
    }
  };

  const openShare = (cfg: NonNullable<typeof shareCfg>) => {
    setShareCfg(cfg);
    setShareOpen(true);
  };

  const handleWhatsAppReminder = (r: Receivable) => {
    let msgTemplate = pixSettings.whatsappReminderMsg;
    if (r.status === 'overdue') {
      msgTemplate = pixSettings.whatsappOverdueMsg;
    }
    const msg = msgTemplate
      .replace(/{nome}/g, r.clientName || 'Cliente')
      .replace(/{valor}/g, fmt(r.amount))
      .replace(/{vencimento}/g, fmtDate(r.dueDate));
      
    let phoneParam = '';
    if (r.clientName) {
      const contact = contacts.find(c => c.name === r.clientName);
      if (contact && contact.phone) {
        let cleanedPhone = contact.phone.replace(/\D/g, '');
        if (cleanedPhone.length === 10 || cleanedPhone.length === 11) {
          cleanedPhone = `55${cleanedPhone}`;
        }
        phoneParam = cleanedPhone;
      }
    }
    
    const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleWhatsAppReminderSelected = () => {
    const items = Array.from(selectedIds).map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
    if (items.length === 0) return;
    
    const hasOverdue = items.some(r => r.status === 'overdue');
    let msgTemplate = pixSettings.whatsappBulkReminderMsg || pixSettings.whatsappReminderMsg;
    if (hasOverdue) {
      msgTemplate = pixSettings.whatsappBulkOverdueMsg || pixSettings.whatsappOverdueMsg;
    }
    
    const amt = bulkPartialMode && bulkPartialAmount && parseFloat(bulkPartialAmount) > 0 
      ? parseFloat(bulkPartialAmount) 
      : items.reduce((s, r) => s + r.amount, 0);
      
    const r = items[0];
    const isSameClient = items.every(i => (i.clientName || '').trim().toLowerCase() === (r.clientName || '').trim().toLowerCase());
    const clientName = isSameClient ? r.clientName : 'Diversos';
    
    const msg = msgTemplate
      .replace(/{nome}/g, clientName || 'Cliente')
      .replace(/{valor}/g, fmt(amt))
      .replace(/{vencimento}/g, fmtDate(r.dueDate))
      .replace(/{quantidade}/g, items.length.toString());
      
    let phoneParam = '';
    if (clientName !== 'Diversos') {
      const contact = contacts.find(c => (c.name || '').trim().toLowerCase() === (clientName || '').trim().toLowerCase());
      if (contact && contact.phone) {
        let cleanedPhone = contact.phone.replace(/\D/g, '');
        if (cleanedPhone.length === 10 || cleanedPhone.length === 11) {
          cleanedPhone = `55${cleanedPhone}`;
        }
        phoneParam = cleanedPhone;
      }
    }
      
    const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
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
          pixKeyType: pixSettings.pixKeyType,
          amount: r.amount,
          beneficiaryName: pixSettings.beneficiaryName,
          beneficiaryCity: pixSettings.beneficiaryCity,
          txid: r.id.replace(/-/g, '').substring(0, 25),
          description: r.description,
        });
      })(),
    });
  };

  const handleShareReceipt = (r: Receivable) => {
    const accName = r.accountId ? (data.accounts.find(a => a.id === r.accountId)?.name || '') : '';
    const receivedDate = r.paymentDate || format(new Date(), 'yyyy-MM-dd');
    openShare({
      title: 'Compartilhar Recibo',
      filenameBase: `recibo-${r.clientName.replace(/\s+/g, '_')}-${receivedDate}`,
      generatePDF: () => generateReceiptPDF({
        id: r.id, clientName: r.clientName, description: r.description,
        amount: r.amount + (r.interestAmount || 0) - (r.discountAmount || 0), receivedDate, accountName: accName,
        interestAmount: r.interestAmount, discountAmount: r.discountAmount
      }, pixSettings),
      generatePNG: () => generateReceiptPNG({
        id: r.id, clientName: r.clientName, description: r.description,
        amount: r.amount + (r.interestAmount || 0) - (r.discountAmount || 0), receivedDate, accountName: accName,
        interestAmount: r.interestAmount, discountAmount: r.discountAmount
      }, pixSettings),
    });
  };

  const handleGenerateReportSelected = () => {
    const items = Array.from(selectedIds).map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
    if (items.length === 0) return;
    const clientNames = Array.from(new Set(items.map(i => i.clientName))).join(', ');
    openShare({
      title: 'Relatório de Contas a Receber',
      filenameBase: `relatorio-contas-${clientNames.replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}`,
      generatePDF: () => generateReceivablesReportPDF(items, pixSettings),
      generatePNG: () => generateReceivablesReportPNG(items, pixSettings),
    });
  };

  const handleGenerateChargesSelected = () => {
    if (!isConfigured) { setPixWarningOpen(true); return; }
    const items = Array.from(selectedIds).map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
    if (items.length === 0) return;
    if (items.length === 1) { handleGenerateCharge(items[0]); return; }

    // Consolidated single charge: sum amounts, earliest due date
    const total = items.reduce((s, r) => s + r.amount, 0);
    const isSameClient = items.every(i => (i.clientName || '').trim().toLowerCase() === (items[0].clientName || '').trim().toLowerCase());
    const clientName = isSameClient ? items[0].clientName : 'Diversos';
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
          pixKeyType: pixSettings.pixKeyType,
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
  const interestAmount = receivingTotal * (parseFloat(interestPercent) || 0) / 100;
  const calculatedDiscount = receiveDiscountType === 'PERCENT'
    ? receivingTotal * (parseFloat(receiveDiscountAmount) || 0) / 100
    : (parseFloat(receiveDiscountAmount) || 0);
  const finalReceivingTotal = Math.max(0, receivingTotal + interestAmount - calculatedDiscount);
  const selectedReceiveAccount = data.accounts.find(a => a.id === receiveAccountId);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{SAFE_LABELS.receivables}</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus recebimentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setOfxDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2 text-primary" />Conciliar OFX
          </Button>

          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Novo Recebível</Button>
            </DialogTrigger>
          <DialogContent 
            className="max-h-[90vh] overflow-y-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Novo'} Recebível</DialogTitle></DialogHeader>
              <ReceivableForm item={editingItem} categories={data.categories.filter(c => c.type === 'income')} accounts={data.accounts}
                onSave={(r) => {
                  const { installments, recurrence, ...receivable } = r;
                  if (editingItem) {
                    const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase();
                    const baseDesc = stripSuffix(editingItem.description);
                    const isLinked = editingItem.recurring || /\(\d+\/\d+\)\s*$/.test(editingItem.description);
                    const linkedFuture = isLinked
                      ? data.receivables.filter(x =>
                          x.id !== editingItem.id &&
                          (x.recurring || /\(\d+\/\d+\)\s*$/.test(x.description)) &&
                          x.clientName === editingItem.clientName &&
                          x.categoryId === editingItem.categoryId &&
                          x.dueDate >= editingItem.dueDate &&
                          stripSuffix(x.description) === baseDesc &&
                          x.status !== 'received'
                        )
                      : [];
                    if (linkedFuture.length > 0) {
                      setUpdateFuturePayload(receivable as Receivable);
                      setUpdateFutureTarget(editingItem);
                      setUpdateFutureCount(linkedFuture.length);
                      setDialogOpen(false);
                      setEditingItem(null);
                    } else {
                      updateReceivable({ ...receivable, id: editingItem.id } as Receivable);
                      setDialogOpen(false);
                      setEditingItem(null);
                    }
                  } else {
                    addReceivable(receivable, installments, recurrence);
                    setDialogOpen(false);
                    setEditingItem(null);
                  }
                }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!isConfigured && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span className="flex-1">Configure seus dados PIX para gerar cobranças com QR Code.</span>
          <Link to="/settings"><Button variant="outline" size="sm">Configurar</Button></Link>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <SearchAutocomplete
          value={search}
          onChange={setSearch}
          options={clientOptions}
          placeholder="Buscar cliente ou descrição..."
          className="flex-1 min-w-[200px]"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending_overdue">Pendente/Atrasado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="received">Recebido</SelectItem>
            <SelectItem value="overdue">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>

        <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center w-full">
          <div className="flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
          <span className="text-muted-foreground text-sm mx-3">até</span>
          <div className="flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="past-overdue" checked={showPastOverdue} onCheckedChange={(c) => setShowPastOverdue(!!c)} />
          <Label htmlFor="past-overdue" className="text-sm cursor-pointer whitespace-nowrap text-muted-foreground">Incluir atrasados anteriores</Label>
        </div>

        <div className="flex items-center justify-between w-full">
          <div className="flex-1">
            <MonthYearPicker
              value={dateFrom && dateTo && format(dateFrom, 'yyyy-MM') === format(dateTo, 'yyyy-MM') ? dateFrom : undefined}
              onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
              active={!!(dateFrom && dateTo && format(dateFrom, 'yyyy-MM') === format(new Date(), 'yyyy-MM') && format(dateTo, 'yyyy-MM') === format(new Date(), 'yyyy-MM'))}
              className="w-full"
            />
          </div>
          <div className="flex justify-center flex-none mx-2">
            <div className="flex items-center bg-muted/50 p-1 rounded-md border border-border">
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
          <div className="flex-1">
            {(dateFrom || dateTo) ? (
              <Button variant="outline" size="sm" onClick={clearDateFilter} className="w-full">
                <X className="h-4 w-4 mr-1 shrink-0" />Limpar
              </Button>
            ) : <div />}
          </div>
        </div>
      </div>

      {/* Totals + bulk actions */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border flex-wrap">
        <span className="text-sm text-muted-foreground">Total exibido:</span>
        <span className="text-lg font-bold text-success mono">{fmt(totalFiltered)}</span>
        <span className="text-xs text-muted-foreground">({filtered.length} {filtered.length === 1 ? 'item' : 'itens'})</span>
        {selectedIds.size > 0 && (
          <div className="ml-auto flex flex-col gap-2 items-end w-full sm:w-auto">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Selecionado: <strong className="text-foreground mono">{fmt(selectedTotal)}</strong> ({selectedIds.size})</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border">
                <Checkbox
                  id="bulkPartial"
                  checked={bulkPartialMode}
                  onCheckedChange={(c) => {
                    const checked = c === true;
                    setBulkPartialMode(checked);
                    if (checked && !bulkPartialAmount) setBulkPartialAmount((selectedTotal / 2).toFixed(2));
                    if (!checked) setBulkPartialAmount('');
                  }}
                />
                <Label htmlFor="bulkPartial" className="cursor-pointer text-xs whitespace-nowrap">Parcial</Label>
              </div>
            </div>
            {bulkPartialMode && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedTotal}
                  value={bulkPartialAmount}
                  onChange={(e) => setBulkPartialAmount(e.target.value)}
                  placeholder="Valor parcial"
                  className="h-8 w-36 text-sm"
                />
                {bulkPartialAmount && parseFloat(bulkPartialAmount) > 0 && parseFloat(bulkPartialAmount) < selectedTotal && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Restante: <strong className="mono text-success">{fmt(selectedTotal - parseFloat(bulkPartialAmount))}</strong>
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => {
                if (bulkPartialMode && bulkPartialAmount && parseFloat(bulkPartialAmount) > 0) {
                  // Gerar boleto PIX com valor parcial
                  if (!isConfigured) { setPixWarningOpen(true); return; }
                  const items = Array.from(selectedIds).map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
                  if (items.length === 0) return;
                  const amt = parseFloat(bulkPartialAmount);
                  const r = items[0];
                  const isSameClient = items.every(i => (i.clientName || '').trim().toLowerCase() === (r.clientName || '').trim().toLowerCase());
                  const clientName = isSameClient ? r.clientName : 'Diversos';
                  const description = items.length > 1
                    ? `Pagamento parcial \u2014 ${items.length} cobran\u00e7as`
                    : `${r.description} (parcial)`;
                  openShare({
                    title: 'Boleto PIX \u2014 Valor Parcial',
                    filenameBase: `cobranca-parcial-${clientName.replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}`,
                    generatePDF: () => generateChargePDF({
                      id: r.id, clientName, description, amount: amt, dueDate: r.dueDate,
                    }, pixSettings),
                    generatePNG: () => generateChargePNG({
                      id: r.id, clientName, description, amount: amt, dueDate: r.dueDate,
                    }, pixSettings),
                    pixCopyText: (async () => {
                      const { generatePixBRCode } = await import('@/lib/pix');
                      return generatePixBRCode({
                        pixKey: pixSettings.pixKey,
                        pixKeyType: pixSettings.pixKeyType,
                        amount: amt,
                        beneficiaryName: pixSettings.beneficiaryName,
                        beneficiaryCity: pixSettings.beneficiaryCity,
                        txid: r.id.replace(/-/g, '').substring(0, 25),
                        description,
                      });
                    })(),
                  });
                } else {
                  handleGenerateChargesSelected();
                }
              }}>
                <QrCode className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">
                  {bulkPartialMode && bulkPartialAmount && parseFloat(bulkPartialAmount) > 0
                    ? `Boleto PIX ${fmt(parseFloat(bulkPartialAmount))}`
                    : 'Gerar boleto PIX'}
                </span>
              </Button>
              <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={handleGenerateReportSelected}>
                <FileText className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Gerar Relatório</span>
              </Button>
              <Button size="sm" variant="outline" className="flex-1 sm:flex-none text-green-500 hover:text-green-600 border-green-500/30 hover:bg-green-500/10" onClick={handleWhatsAppReminderSelected}>
                <MessageCircle className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">WhatsApp</span>
              </Button>
              <Button size="sm" className="flex-1 sm:flex-none bg-success text-success-foreground hover:bg-success/90" onClick={handleReceiveSelected}>
                <CheckCircle className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">
                  {bulkPartialMode ? 'Receber parcial' : 'Receber selecionados'}
                </span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {(() => {
        let groups: Record<string, Receivable[]> = {};
        
        if (groupBy === 'contact') {
          groups = filtered.reduce<Record<string, Receivable[]>>((acc, r) => {
            const client = r.clientName || 'Diversos';
            if (!acc[client]) acc[client] = [];
            acc[client].push(r);
            return acc;
          }, {});
        } else {
          groups = filtered.reduce<Record<string, Receivable[]>>((acc, r) => {
            const dateKey = r.dueDate || 'Sem Data';
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(r);
            return acc;
          }, {});
        }
        
        const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

        if (sortedKeys.length === 0) {
          return (
            <div className="finance-card p-12 text-center text-muted-foreground">
              Nenhum recebível encontrado
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {sortedKeys.map(key => {
              const displayName = groupBy === 'date' ? (key === 'Sem Data' ? key : fmtDate(key)) : key;
              return (
                <ClientGroupTable
                  key={key}
                  clientName={displayName}
                  items={groups[key]}
                getCategoryName={getCategoryName}
                getAccountName={getAccountName}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                setSelectedIds={setSelectedIds}
                handleMarkReceived={(id: string) => { setReceivingIds([id]); setReceiveAccountId(data.receivables.find(x => x.id === id)?.accountId || data.accounts[0]?.id || ''); setReceiveDialogOpen(true); }}
                handleGenerateCharge={handleGenerateCharge}
                handleWhatsAppReminder={handleWhatsAppReminder}
                handleShareReceipt={handleShareReceipt}
                setEditingItem={setEditingItem}
                setDialogOpen={setDialogOpen}
                setDeleteId={setDeleteId}
                pixSettings={pixSettings}
              />
              );
            })}
          </div>
        );
      })()}

      {/* Receive dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">{receivingIds.length > 1 ? `${receivingIds.length} itens` : 'Valor'} original</span>
              <span className="text-lg font-bold text-muted-foreground mono">{fmt(receivingTotal)}</span>
            </div>
            
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Juros (%)</Label>
                  <Input type="number" step="0.1" min="0" value={interestPercent} onChange={(e) => setInterestPercent(e.target.value)} placeholder="0.0" />
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <div className="flex gap-1">
                    <Input type="number" step="0.01" min="0" value={receiveDiscountAmount} onChange={(e) => setReceiveDiscountAmount(e.target.value)} placeholder="0,00" />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-12 shrink-0 font-bold"
                      onClick={() => setReceiveDiscountType(prev => prev === 'BRL' ? 'PERCENT' : 'BRL')}
                    >
                      {receiveDiscountType === 'BRL' ? 'R$' : '%'}
                    </Button>
                  </div>
                </div>
              </div>

            <div className="flex items-center justify-between p-3 rounded-md bg-primary/10 border border-primary/20">
              <span className="text-sm font-semibold text-primary">Valor a receber</span>
              <span className="text-xl font-bold text-success mono">{fmt(finalReceivingTotal)}</span>
            </div>
            {receivingIds.length > 1 && (() => {
              const items = receivingIds.map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
              return (
                <div className="rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowReceiveItems(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {showReceiveItems ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      Ver descrição dos recebíveis ({items.length})
                    </span>
                  </button>
                  {showReceiveItems && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-border border-t border-border">
                      {items.map(it => (
                        <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                          <span className="text-muted-foreground mono whitespace-nowrap">{fmtDate(it.dueDate)}</span>
                          <span className="flex-1 truncate">{it.description}</span>
                          <span className="mono font-medium text-success whitespace-nowrap">{fmt(it.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
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
                  Saldo após recebimento: <span className="font-semibold mono">{fmt(selectedReceiveAccount.balance + (partialMode && partialAmount ? parseFloat(partialAmount) || 0 : finalReceivingTotal))}</span>
                </p>
              )}
            </div>
            {(() => {
              const recItems = receivingIds.map(id => data.receivables.find(r => r.id === id)).filter(Boolean) as Receivable[];
              const sameClient = recItems.length > 0 && recItems.every(r => (r.clientName || '').trim().toLowerCase() === (recItems[0].clientName || '').trim().toLowerCase());
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
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {recItems.length > 1 ? 'Valor recebido agora (FIFO — quita os mais antigos primeiro)' : 'Valor recebido agora'}
                    </Label>
                    <Input type="number" step="0.01" min="0.01" max={finalReceivingTotal} value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)} placeholder="0,00" />
                    <p className="text-xs text-muted-foreground mt-1">O saldo restante de {fmt(Math.max(0, finalReceivingTotal - (parseFloat(partialAmount) || 0)))} será criado como uma nova conta pendente.</p>
                    {partialAmount && parseFloat(partialAmount) > 0 && parseFloat(partialAmount) < receivingTotal && (
                      <p className="text-xs text-muted-foreground">
                        Saldo restante: <span className="font-semibold mono text-success">{fmt(receivingTotal - parseFloat(partialAmount))}</span> — {recItems.length > 1 ? `os recebíveis mais antigos serão quitados integralmente; o próximo ficará parcial com saldo restante individual.` : 'será criado um novo recebível pendente com os mesmos dados.'}
                      </p>
                    )}
                    {partialAmount && parseFloat(partialAmount) >= receivingTotal && (
                      <p className="text-xs text-warning">Valor igual ou maior que o total — será registrado como recebimento integral.</p>
                    )}
                    {isConfigured && partialAmount && parseFloat(partialAmount) > 0 && parseFloat(partialAmount) < receivingTotal && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10"
                        onClick={() => {
                          const amt = parseFloat(partialAmount);
                          if (!amt || amt <= 0) return;
                          const r = recItems[0];
                          const isSameClient = recItems.every(i => (i.clientName || '').trim().toLowerCase() === (r.clientName || '').trim().toLowerCase());
                          const clientName = isSameClient ? r.clientName : 'Diversos';
                          const description = recItems.length > 1
                            ? `Pagamento parcial — ${recItems.length} cobranças`
                            : `${r.description} (parcial)`;
                          openShare({
                            title: 'Boleto PIX — Valor Parcial',
                            filenameBase: `cobranca-parcial-${clientName.replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}`,
                            generatePDF: () => generateChargePDF({
                              id: r.id, clientName, description, amount: amt,
                              dueDate: r.dueDate,
                            }, pixSettings),
                            generatePNG: () => generateChargePNG({
                              id: r.id, clientName, description, amount: amt,
                              dueDate: r.dueDate,
                            }, pixSettings),
                            pixCopyText: (async () => {
                              const { generatePixBRCode } = await import('@/lib/pix');
                              return generatePixBRCode({
                                pixKey: pixSettings.pixKey,
                                amount: amt,
                                beneficiaryName: pixSettings.beneficiaryName,
                                beneficiaryCity: pixSettings.beneficiaryCity,
                                txid: r.id.replace(/-/g, '').substring(0, 25),
                                description,
                              });
                            })(),
                          });
                        }}
                      >
                        <QrCode className="h-4 w-4" />
                        Gerar Boleto PIX com valor parcial ({partialAmount ? fmt(parseFloat(partialAmount)) : ''})
                      </Button>
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

      {(() => {
        const target = deleteId ? data.receivables.find(r => r.id === deleteId) : null;
        if (!target) {
          return (
            <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}
              onConfirm={() => { if (deleteId) { deleteReceivable(deleteId); setDeleteId(null); } }}
              title="Excluir recebível?" description="Tem certeza que deseja excluir este recebível? Esta ação não pode ser desfeita." />
          );
        }
        const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase();
        const baseDesc = stripSuffix(target.description);
        const isLinked = target.recurring || /\(\d+\/\d+\)\s*$/.test(target.description);
        const linkedFuture = isLinked
          ? data.receivables.filter(r =>
              r.id !== target.id &&
              (r.recurring || /\(\d+\/\d+\)\s*$/.test(r.description)) &&
              r.clientName === target.clientName &&
              r.categoryId === target.categoryId &&
              r.dueDate >= target.dueDate &&
              stripSuffix(r.description) === baseDesc &&
              r.status !== 'received'
            )
          : [];
        const hasFuture = linkedFuture.length > 0;
        if (!hasFuture) {
          return (
            <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}
              onConfirm={() => { deleteReceivable(target.id); setDeleteId(null); }}
              title="Excluir recebível?" description="Tem certeza que deseja excluir este recebível? Esta ação não pode ser desfeita." />
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
                  onClick={() => { deleteReceivable(target.id); setDeleteId(null); }}
                >
                  Apenas esta
                </AlertDialogAction>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    const n = await deleteReceivableWithFuture(target.id);
                    setDeleteId(null);
                    if (n > 1) toast.success(`${n} recebíveis vinculados excluídos`);
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
              Esta conta faz parte de uma série recorrente ou parcelada. Existem <strong>{updateFutureCount}</strong> ocorrência(s) futura(s) pendente(s) vinculada(s). Deseja aplicar as alterações de cliente, categoria, valor e observações apenas nesta conta ou em todas as futuras também?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => {
                if (updateFuturePayload && updateFutureTarget) {
                  updateReceivable({ ...updateFuturePayload, id: updateFutureTarget.id });
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
                  const n = await updateReceivableWithFuture({ ...updateFuturePayload, id: updateFutureTarget.id });
                  if (n > 1) toast.success(`${n} recebíveis vinculados alterados`);
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

      {/* OFX Reconciliation Dialog */}
      <Dialog open={ofxDialogOpen} onOpenChange={(open) => {
        setOfxDialogOpen(open);
        if (!open) {
          setOfxTransactions([]);
          setSelectedOfxAccountId('');
          setOfxStep('upload');
          setReconciliations({});
          setIsProcessingOfx(false);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Upload className="h-5 w-5 text-primary" />
              Conciliação Bancária via OFX
            </DialogTitle>
          </DialogHeader>
          
          {ofxStep === 'upload' && (
            <div className="space-y-6 my-4 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">1. Selecione a Conta Bancária de Destino</Label>
                <Select value={selectedOfxAccountId} onValueChange={setSelectedOfxAccountId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a conta que recebeu os valores" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.accounts.length === 0 ? (
                      <SelectItem value="none" disabled>Nenhuma conta cadastrada</SelectItem>
                    ) : (
                      data.accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{a.name}</span>
                            <span className="text-xs text-muted-foreground mono">Saldo: {fmt(a.balance)}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  As transações do extrato serão conciliadas como recebidas nesta conta e os saldos serão atualizados.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">2. Envie o arquivo de extrato bancário (.ofx)</Label>
                <div 
                  className={cn(
                    "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer bg-muted/30 hover:bg-muted/50",
                    dragActive ? "border-primary bg-primary/5" : "border-border",
                    !selectedOfxAccountId && "opacity-50 pointer-events-none"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (!selectedOfxAccountId) return;
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleOfxFile(file);
                  }}
                  onClick={() => {
                    if (selectedOfxAccountId) {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.ofx';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleOfxFile(file);
                      };
                      input.click();
                    } else {
                      toast.warning('Selecione uma conta bancária antes de enviar o arquivo');
                    }
                  }}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-sm">Arrastar e soltar arquivo OFX aqui</h3>
                  <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar do computador</p>
                </div>
              </div>
            </div>
          )}

          {ofxStep === 'reconcile' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-4 my-2 overflow-hidden">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                <span className="text-muted-foreground">Conta selecionada: <strong>{data.accounts.find(a => a.id === selectedOfxAccountId)?.name}</strong></span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">Passo 2 de 2</span>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[50vh] pr-1 space-y-3 divide-y divide-border">
                {ofxTransactions.map((tx, idx) => {
                  const candidates = tx.candidates || [];
                  const selectedId = reconciliations[tx.id] || 'ignore';
                  
                  return (
                    <div key={tx.id} className={cn("pt-4 first:pt-0 flex flex-col gap-3", idx > 0 && "border-t border-border")}>
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div className="space-y-1 max-w-md">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground mono">{fmtDate(tx.date)}</span>
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-success/10 text-success uppercase tracking-wider flex items-center gap-1">
                              PIX / Entrada
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate" title={tx.memo}>{tx.memo}</p>
                        </div>
                        <span className="text-base font-bold text-success mono">+{fmt(tx.amount)}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <Label className="text-xs text-muted-foreground md:col-span-3">Vincular recebível:</Label>
                        <div className="md:col-span-9">
                          <Select 
                            value={selectedId} 
                            onValueChange={(val) => {
                              setReconciliations(prev => ({ ...prev, [tx.id]: val }));
                            }}
                          >
                            <SelectTrigger className={cn(
                              "w-full text-xs h-9",
                              selectedId !== 'ignore' && "border-success bg-success/5 text-success-foreground"
                            )}>
                              <SelectValue placeholder="Selecione um recebível" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[400px]">
                              <SelectItem value="ignore" className="text-xs font-semibold text-muted-foreground">
                                🚫 Ignorar esta transação (não conciliar)
                              </SelectItem>
                              
                              {candidates.length > 0 && (
                                <div className="px-2 py-1.5 text-[10px] font-bold text-primary bg-primary/5 uppercase tracking-wider">
                                  ★ Sugestões Recomendadas
                                </div>
                              )}
                              
                              {candidates.map((c: any) => (
                                <SelectItem key={c.receivable.id} value={c.receivable.id} className="text-xs">
                                  💡 {c.receivable.clientName} - {fmt(c.receivable.amount)} (Venc: {fmtDate(c.receivable.dueDate)}) - Match: {c.score}%
                                </SelectItem>
                              ))}
                              
                              {data.receivables.filter(r => r.status !== 'received' && !candidates.some((c: any) => c.receivable.id === r.id)).length > 0 && (
                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-border mt-1">
                                  Outros Recebíveis Pendentes
                                </div>
                              )}
                              
                              {data.receivables
                                .filter(r => r.status !== 'received' && !candidates.some((c: any) => c.receivable.id === r.id))
                                .map(r => (
                                  <SelectItem key={r.id} value={r.id} className="text-xs">
                                    {r.clientName} - {fmt(r.amount)} (Venc: {fmtDate(r.dueDate)}) {r.description ? ` - ${r.description}` : ''}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          
                          {selectedId !== 'ignore' && (() => {
                            const matchedRec = data.receivables.find(r => r.id === selectedId);
                            const cand = candidates.find((c: any) => c.receivable.id === selectedId);
                            if (matchedRec) {
                              return (
                                <p className="text-[11px] text-success font-medium mt-1 flex items-center gap-1">
                                  ✔️ Conciliação vinculada a <strong>{matchedRec.clientName}</strong>. 
                                  {cand && cand.reasons.length > 0 && ` (${cand.reasons.join(', ')})`}
                                </p>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4 mt-2 flex-wrap gap-3">
                <span className="text-xs text-muted-foreground">
                  Das <strong>{ofxTransactions.length}</strong> transações encontradas, 
                  <strong> {Object.values(reconciliations).filter(v => v !== 'ignore').length}</strong> serão liquidadas.
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOfxStep('upload')}>Voltar</Button>
                  <Button 
                    className="bg-success text-success-foreground hover:bg-success/90 font-semibold" 
                    size="sm"
                    disabled={isProcessingOfx}
                    onClick={confirmOfxReconciliation}
                  >
                    {isProcessingOfx ? (
                      <>Processando...</>
                    ) : (
                      <>Confirmar Conciliações</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {ofxStep === 'success' && (
            <div className="flex flex-col items-center justify-center p-8 text-center my-6 space-y-4">
              <div className="h-16 w-16 bg-success/10 text-success rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold">Conciliação concluída com sucesso!</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                As transações foram processadas, os respectivos recebíveis foram marcados como recebidos e os saldos das contas foram atualizados.
              </p>
              <Button onClick={() => setOfxDialogOpen(false)} className="mt-4">
                Fechar Janela
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceivableForm({ item, categories, accounts, onSave }: {
  item: Receivable | null; categories: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  onSave: (r: Omit<Receivable, 'id'> & { installments?: number; recurrence?: { frequency: RecurrenceFrequency; occurrences: number } }) => void;
}) {
  const { data } = useFinance();
  const [clientName, setClientName] = useState(item?.clientName || '');

  const handleClientChange = (val: string) => {
    setClientName(val);
    if (!item && val) {
      const existing = data.receivables
        .filter(r => r.clientName.toLowerCase() === val.toLowerCase())
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];

      if (existing && existing.dueDate) {
        const existingDay = parseInt(existing.dueDate.split('-')[2], 10);
        const now = new Date();
        const currentDay = now.getDate();
        let targetMonth = now.getMonth() + 1;
        let targetYear = now.getFullYear();
        
        if (existingDay < currentDay) {
          targetMonth += 1;
          if (targetMonth > 12) {
            targetMonth = 1;
            targetYear += 1;
          }
        }
        
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
        const finalDay = Math.min(existingDay, lastDayOfTargetMonth);
        
        const newDueDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
        setDueDate(newDueDate);
      }
    }
  };
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
  const [occurrences, setOccurrences] = useState<string>('');

  const installmentAmount = amount ? (parseFloat(amount) / installments) : 0;

  return (
    <div className="space-y-4">
      <div><Label>Nome do Cliente</Label><ContactAutocomplete value={clientName} onChange={handleClientChange} placeholder="Nome do cliente" /></div>
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
        </>
      )}

      <div><Label>Notas (opcional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <Button className="w-full" disabled={!clientName || !description || !categoryId || !amount || !dueDate}
        onClick={() => {
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
            clientName, description, categoryId, accountId: accountId || undefined,
            amount: parseFloat(amount), dueDate, status: item?.status || 'pending',
            notes: notes || undefined,
            recurring: isRecurring || undefined,
            recurrenceFrequency: isRecurring ? recurrenceFrequency : undefined,
            installments: (useInstallments && installments > 1) ? installments : undefined,
            recurrence: recurrencePayload,
          });
        }}>
        {item ? 'Atualizar' : 'Criar'} Recebível
      </Button>
    </div>
  );
}
