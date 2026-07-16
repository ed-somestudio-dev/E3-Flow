import { useState, useMemo, useRef } from 'react';
import { usePersistedDialog, usePersistedFormDraft } from '@/hooks/usePersistedDialog';
import { ContactInputWithPicker } from '@/components/ContactInputWithPicker';
import { useContacts } from '@/lib/contacts-context';
import { useSales, NewSaleItem, NewSalePayload } from '@/lib/sales-context';
import { useFinance } from '@/lib/finance-context';
import { usePixSettings } from '@/lib/pix-settings-context';
import { Sale, SaleStatus } from '@/lib/types';
import { cn, removeAccents } from '@/lib/utils';
import { ShareDocumentDialog } from '@/components/ShareDocumentDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import {
  Plus, Search, ShoppingCart, Trash2, CheckCircle2, XCircle,
  Clock, TrendingUp, Package, Receipt, ChevronDown, ChevronUp,
  Truck, CheckCheck, MessageCircle, Edit2, QrCode, Printer
} from 'lucide-react';
import {
  generateChargePDF, generateChargePNG,
  generateReceiptPDF, generateReceiptPNG,
  generateReceivablesReportPDF, generateReceivablesReportPNG
} from '@/lib/documents';
import { fmt, fmtDate } from '@/lib/format';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATUS_MAP: Record<SaleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:    { label: 'Pendente',     variant: 'outline' },
  completed:  { label: 'Aprovada',     variant: 'default' },
  preparing:  { label: 'Em Separação', variant: 'secondary' },
  dispatched: { label: 'Despachado',   variant: 'default' },
  delivered:  { label: 'Entregue',     variant: 'outline' },
  cancelled:  { label: 'Cancelada',    variant: 'destructive' },
};

const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Boleto', 'Transferência', 'Outro'];

function SaleCard({ sale, onStatusChange, onUpdateShipping, onDelete, onEdit, selectable, selected, onSelect, onReceive }: {
  sale: Sale;
  onStatusChange: (id: string, s: SaleStatus) => void;
  onUpdateShipping: (id: string, trackingInfo: any) => void;
  onDelete: (id: string) => void;
  onEdit?: (sale: Sale) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onReceive?: (sale: Sale) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [completeConfirm, setCompleteConfirm] = useState(false);
  const [shippingModal, setShippingModal] = useState(false);
  
  const [trackingCode, setTrackingCode] = useState(sale.trackingCode || '');
  const [carrier, setCarrier] = useState(sale.carrier || '');

  const st = STATUS_MAP[sale.status];

  return (
    <>
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="finance-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {selectable && (
              <Checkbox checked={selected} onCheckedChange={(c) => onSelect?.(sale.id, !!c)} />
            )}
            <span className="font-semibold">{sale.clientName || 'Cliente não informado'}</span>
            <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(sale.saleDate)} · {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
            {sale.paymentMethod && ` · ${sale.paymentMethod}`}
          </p>
        </div>
        <span className="text-lg font-bold text-primary mono shrink-0">{fmt(sale.total)}</span>
      </div>

      {(sale.trackingCode || sale.carrier) && (
        <div className="bg-muted/40 rounded border border-border p-2 text-xs flex flex-col gap-1">
          {sale.carrier && <div><span className="text-muted-foreground">Transportadora:</span> {sale.carrier}</div>}
          {sale.trackingCode && <div><span className="text-muted-foreground">Rastreio:</span> <span className="font-mono bg-muted px-1 py-0.5 rounded">{sale.trackingCode}</span></div>}
        </div>
      )}

      {/* Expandable items */}
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Ocultar itens' : 'Ver itens'}
      </button>

      {expanded && (
        <div className="space-y-1 bg-secondary/30 rounded-md p-3">
          {sale.items.map(item => (
            <div key={item.id} className="flex justify-between text-xs">
              <span>{item.productName} × {item.quantity}</span>
              <span className="mono">{fmt(item.total)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {sale.status === 'pending' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-success border-success/40 hover:bg-success/10"
                onClick={() => onReceive?.(sale)}>
                <CheckCircle2 className="h-3 w-3" /> Receber
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-primary border-primary/40 hover:bg-primary/10"
                onClick={() => onEdit?.(sale)}>
                <Edit2 className="h-3 w-3" /> Editar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setCancelConfirm(true)}>
                <XCircle className="h-3 w-3" /> Cancelar
              </Button>
            </>
          )}
          {sale.status === 'completed' && (
            <>
              {sale.requiresShipping && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-primary border-primary/40 hover:bg-primary/10"
                  onClick={() => onStatusChange(sale.id, 'preparing')}>
                  <Package className="h-3 w-3" /> Separar
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setCancelConfirm(true)}>
                <XCircle className="h-3 w-3" /> Cancelar
              </Button>
            </>
          )}
          {sale.status === 'preparing' && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-primary border-primary/40 hover:bg-primary/10"
              onClick={() => setShippingModal(true)}>
              <Truck className="h-3 w-3" /> Despachar
            </Button>
          )}
          {sale.status === 'dispatched' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-success border-success/40 hover:bg-success/10"
                onClick={() => onStatusChange(sale.id, 'delivered')}>
                <CheckCheck className="h-3 w-3" /> Marcar Entregue
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-border"
                onClick={() => setShippingModal(true)}>
                <Truck className="h-3 w-3" /> Rastreio
              </Button>
            </>
          )}
          {sale.status === 'delivered' && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Olá ${sale.clientName || ''}! Vi que seu pedido acabou de ser entregue. Deu tudo certo? Gostou do produto? Qualquer dúvida estamos à disposição!`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-success border-success/40 hover:bg-success/10">
                <MessageCircle className="h-3 w-3" /> Pós-Venda
              </Button>
            </a>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(sale.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>

    <Dialog open={shippingModal} onOpenChange={setShippingModal}>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Despachar Produto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Transportadora</Label>
            <Input placeholder="Ex: Correios, Loggi" value={carrier} onChange={e => setCarrier(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Código de Rastreio</Label>
            <Input placeholder="Ex: QA123456789BR" value={trackingCode} onChange={e => setTrackingCode(e.target.value)} />
          </div>
          <Button className="w-full mt-2" onClick={() => {
            onUpdateShipping(sale.id, { carrier, trackingCode });
            if (sale.status === 'preparing') onStatusChange(sale.id, 'dispatched');
            setShippingModal(false);
          }}>
            Salvar e {sale.status === 'preparing' ? 'Despachar' : 'Atualizar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Cancel Confirmation */}
    <AlertDialog open={cancelConfirm} onOpenChange={setCancelConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar venda?</AlertDialogTitle>
          <AlertDialogDescription>
            A venda de <strong>{sale.clientName || 'cliente não informado'}</strong> no valor de <strong>{fmt(sale.total)}</strong> será marcada como cancelada. Esta ação não poderá ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => { onStatusChange(sale.id, 'cancelled'); setCancelConfirm(false); }}
          >
            Sim, cancelar venda
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {/* Complete Confirmation */}
    <AlertDialog open={completeConfirm} onOpenChange={setCompleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Concluir venda?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirma a conclusão da venda de <strong>{sale.clientName || 'cliente não informado'}</strong> no valor de <strong>{fmt(sale.total)}</strong>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => { onStatusChange(sale.id, 'completed'); setCompleteConfirm(false); }}
          >
            Sim, concluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default function SalesPage() {
  const { products, sales, loadingSales, createSale, updateSale, updateSaleStatus, updateSaleShipping, deleteSale } = useSales();
  const { data: financeData, markReceivableReceived, markReceivableReceivedPartial, updateReceivable } = useFinance();
  const { contacts } = useContacts();
  const { settings: pixSettings, isConfigured } = usePixSettings();

  const [tab, setTab] = useState<'all' | SaleStatus>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = usePersistedDialog('sales-sheet');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  // PIX & Share State
  const [pixWarningOpen, setPixWarningOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCfg, setShareCfg] = useState<{
    title: string;
    filenameBase: string;
    generatePDF: () => Promise<Blob>;
    generatePNG: () => Promise<Blob>;
    pixCopyText?: Promise<string>;
  } | null>(null);

  const openShare = (cfg: NonNullable<typeof shareCfg>) => {
    setShareCfg(cfg);
    setShareOpen(true);
  };

  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [bulkReceiveModal, setBulkReceiveModal] = useState(false);
  const [bulkReceiveAmount, setBulkReceiveAmount] = useState<string>('');
  const [bulkReceiveAccount, setBulkReceiveAccount] = useState<string>(localStorage.getItem('last_sale_account') || '');
  const [bulkReceivePaymentMethod, setBulkReceivePaymentMethod] = useState<string>('keep');
  const [receiveInterestPercent, setReceiveInterestPercent] = useState('');
  const [receiveDiscountAmount, setReceiveDiscountAmount] = useState('');
  const [receiveDiscountType, setReceiveDiscountType] = useState<'BRL' | 'PERCENT'>('BRL');
  const [receivePartialMode, setReceivePartialMode] = useState(false);

  // New Sale form
  const initialDraft = {
    clientName: '',
    saleDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    notes: '',
    saleDiscountAmount: '',
    saleDiscountType: 'BRL' as 'BRL' | 'PERCENT',
    completeOnSave: true,
    createReceivable: true,
    requiresShipping: false,
    selectedCategoryId: localStorage.getItem('last_sale_category') || '',
    selectedAccountId: localStorage.getItem('last_sale_account') || '',
    cartItems: [] as (NewSaleItem & { tmpId: string })[],
    productSearch: ''
  };

  const [draft, setDraft, clearDraft] = usePersistedFormDraft(`sales-form-${editingSaleId || 'new'}`, true, initialDraft);

  const { clientName, saleDate, dueDate, paymentMethod, notes, saleDiscountAmount, saleDiscountType, completeOnSave, createReceivable, requiresShipping, selectedCategoryId, selectedAccountId, cartItems, productSearch } = draft;

  const setClientName = (v: any) => setDraft(d => ({ ...d, clientName: typeof v === 'function' ? v(d.clientName) : v }));
  const setSaleDate = (v: any) => setDraft(d => ({ ...d, saleDate: typeof v === 'function' ? v(d.saleDate) : v }));
  const setDueDate = (v: any) => setDraft(d => ({ ...d, dueDate: typeof v === 'function' ? v(d.dueDate) : v }));
  const setPaymentMethod = (v: any) => setDraft(d => ({ ...d, paymentMethod: typeof v === 'function' ? v(d.paymentMethod) : v }));
  const setNotes = (v: any) => setDraft(d => ({ ...d, notes: typeof v === 'function' ? v(d.notes) : v }));
  const setSaleDiscountAmount = (v: any) => setDraft(d => ({ ...d, saleDiscountAmount: typeof v === 'function' ? v(d.saleDiscountAmount) : v }));
  const setSaleDiscountType = (v: any) => setDraft(d => ({ ...d, saleDiscountType: typeof v === 'function' ? v(d.saleDiscountType) : v }));
  const setCompleteOnSave = (v: any) => setDraft(d => ({ ...d, completeOnSave: typeof v === 'function' ? v(d.completeOnSave) : v }));
  const setCreateReceivable = (v: any) => setDraft(d => ({ ...d, createReceivable: typeof v === 'function' ? v(d.createReceivable) : v }));
  const setRequiresShipping = (v: any) => setDraft(d => ({ ...d, requiresShipping: typeof v === 'function' ? v(d.requiresShipping) : v }));
  const setSelectedCategoryId = (v: any) => setDraft(d => ({ ...d, selectedCategoryId: typeof v === 'function' ? v(d.selectedCategoryId) : v }));
  const setSelectedAccountId = (v: any) => setDraft(d => ({ ...d, selectedAccountId: typeof v === 'function' ? v(d.selectedAccountId) : v }));
  const setCartItems = (v: any) => setDraft(d => ({ ...d, cartItems: typeof v === 'function' ? v(d.cartItems) : v }));
  const setProductSearch = (v: any) => setDraft(d => ({ ...d, productSearch: typeof v === 'function' ? v(d.productSearch) : v }));

  const [bulkPartialMode, setBulkPartialMode] = useState(false);
  const [bulkPartialAmount, setBulkPartialAmount] = useState('');

  const incomeCategories = financeData.categories.filter(c => c.type === 'income');
  const accounts = financeData.accounts;

  const filteredProducts = useMemo(() =>
    products.filter(p => p.active && p.name.toLowerCase().includes(productSearch.toLowerCase())),
    [products, productSearch]
  );

  const cartTotal = cartItems.reduce((s, i) => s + i.total, 0);
  const calculatedSaleDiscount = saleDiscountType === 'PERCENT'
    ? cartTotal * (parseFloat(saleDiscountAmount) || 0) / 100
    : (parseFloat(saleDiscountAmount) || 0);
  const finalSaleTotal = Math.max(0, cartTotal - calculatedSaleDiscount);

  const stats = useMemo(() => {
    const completed = sales.filter(s => s.status === 'completed');
    const monthStr = new Date().toISOString().slice(0, 7);
    const monthSales = completed.filter(s => s.saleDate.startsWith(monthStr));
    return {
      total: sales.length,
      completedCount: completed.length,
      monthRevenue: monthSales.reduce((s, v) => s + v.total, 0),
      avgTicket: completed.length ? completed.reduce((s, v) => s + v.total, 0) / completed.length : 0,
    };
  }, [sales]);

  const normalizedSearch = removeAccents(search.toLowerCase());
  const filtered = useMemo(() => sales.filter(s => {
    if (tab !== 'all' && s.status !== tab) return false;
    if (paymentFilter !== 'all' && s.paymentMethod !== paymentFilter) return false;
    if (search && !removeAccents(s.clientName?.toLowerCase() || '').includes(normalizedSearch)) return false;
    return true;
  }), [sales, tab, paymentFilter, normalizedSearch, search]);

  const addToCart = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    
    const existing = cartItems.find(i => i.productId === productId);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = currentQty + 1;

    const originalSale = editingSaleId ? sales.find(s => s.id === editingSaleId) : null;
    const originalItem = originalSale?.items.find(i => i.productId === productId);
    const originalQty = originalItem ? originalItem.quantity : 0;
    const netAddedQty = newQty - originalQty;

    if (netAddedQty > prod.stockQuantity) {
      toast.warning(`Atenção: Estoque insuficiente de "${prod.name}" (Disponível: ${prod.stockQuantity + originalQty})`);
    }

    if (existing) {
      setCartItems(prev => prev.map(i =>
        i.productId === productId
          ? { ...i, quantity: newQty, total: newQty * i.unitPrice }
          : i
      ));
    } else {
      setCartItems(prev => [...prev, {
        tmpId: `tmp-${Date.now()}`, productId: prod.id,
        productName: prod.name, quantity: 1,
        unitPrice: prod.price, total: prod.price,
      }]);
    }
  };

  const updateCartQty = (tmpId: string, qty: number, removeIfZero: boolean = true) => {
    const item = cartItems.find(i => i.tmpId === tmpId);
    if (!item) return;

    if (qty <= 0 && removeIfZero) {
      setCartItems(prev => prev.filter(i => i.tmpId !== tmpId));
    } else {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        const originalSale = editingSaleId ? sales.find(s => s.id === editingSaleId) : null;
        const originalItem = originalSale?.items.find(i => i.productId === item.productId);
        const originalQty = originalItem ? originalItem.quantity : 0;
        const netAddedQty = qty - originalQty;
        
        if (netAddedQty > prod.stockQuantity && qty > 0) {
          toast.warning(`Atenção: Quantidade superior ao estoque disponível (${prod.stockQuantity + originalQty})`);
        }
      }

      setCartItems(prev => prev.map(i =>
        i.tmpId === tmpId ? { ...i, quantity: qty, total: qty * i.unitPrice } : i
      ));
    }
  };

  const resetForm = () => {
    clearDraft();
    setEditingSaleId(null);
    setDraft(initialDraft); // Reset to initial after clearing
  };

  const handleCreateSale = async () => {
    if (cartItems.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    setSaving(true);
    try {
      if (editingSaleId) {
        // Modo edição: atualizar venda existente
        const finalDiscount = saleDiscountType === 'PERCENT'
          ? cartTotal * (parseFloat(saleDiscountAmount) || 0) / 100
          : (parseFloat(saleDiscountAmount) || 0);

        await updateSale(editingSaleId, {
          clientName: clientName || undefined,
          paymentMethod: paymentMethod || undefined,
          notes: notes || undefined,
          saleDate,
          requiresShipping,
          discountAmount: finalDiscount || undefined,
          items: cartItems,
        });
        
        // Atualizar data de vencimento do contas a receber vinculado
        const editedSale = sales.find(s => s.id === editingSaleId);
        if (editedSale?.receivableId && !completeOnSave) {
          const rec = financeData.receivables.find(r => r.id === editedSale.receivableId);
          if (rec && rec.dueDate !== dueDate) {
            await updateReceivable({ ...rec, dueDate });
          }
        }
      } else {
        // Modo criação: nova venda
        const finalDiscount = saleDiscountType === 'PERCENT'
          ? cartTotal * (parseFloat(saleDiscountAmount) || 0) / 100
          : (parseFloat(saleDiscountAmount) || 0);

        const payload: NewSalePayload = {
          clientName: clientName || undefined,
          status: completeOnSave ? 'completed' : 'pending',
          paymentMethod: paymentMethod || undefined,
          notes: notes || undefined,
          saleDate,
          dueDate: !completeOnSave ? dueDate : undefined,
          requiresShipping,
          discountAmount: finalDiscount || undefined,
          items: cartItems,
        };
        await createSale(payload, createReceivable, selectedCategoryId || undefined, selectedAccountId || undefined);
      }
      setSheetOpen(false);
      clearDraft();
      resetForm();
    } finally { setSaving(false); }
  };

  const handleBulkReceive = async () => {
    if (selectedSales.length === 0) return;
    setSaving(true);
    try {
      const items = selectedSales.map(id => sales.find(s => s.id === id)).filter(Boolean) as Sale[];
      const baseTotal = items.reduce((sum, i) => sum + i.total, 0);
      const interestRatio = (parseFloat(receiveInterestPercent) || 0) / 100;
      const totalInterest = baseTotal * interestRatio;
      const totalDiscount = receiveDiscountType === 'PERCENT'
        ? baseTotal * (parseFloat(receiveDiscountAmount) || 0) / 100
        : (parseFloat(receiveDiscountAmount) || 0);
      
      // Receber cada um (do mais antigo para o mais novo)
      const sorted = [...items].sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());
      
      let amount = 0;
      if (receivePartialMode) {
        amount = parseFloat(bulkReceiveAmount) || 0;
      }
      
      const totalDue = baseTotal + totalInterest - totalDiscount;

      for (const sale of sorted) {
        if (receivePartialMode && amount <= 0) break;
        
        if (bulkReceivePaymentMethod !== 'keep') {
          await updateSale(sale.id, { paymentMethod: bulkReceivePaymentMethod });
        }
        
        const itemRatio = baseTotal > 0 ? sale.total / baseTotal : 0;
        const itemInterest = totalInterest * itemRatio;
        const itemDiscount = totalDiscount * itemRatio;
        const itemTotalDue = sale.total + itemInterest - itemDiscount;

        if (!receivePartialMode) {
          if (sale.receivableId && bulkReceiveAccount) {
            await markReceivableReceived(sale.receivableId, bulkReceiveAccount, undefined, itemInterest, itemDiscount);
          }
          await updateSaleStatus(sale.id, 'completed');
        } else {
          if (amount >= itemTotalDue - 0.005) {
            if (sale.receivableId && bulkReceiveAccount) {
              await markReceivableReceived(sale.receivableId, bulkReceiveAccount, undefined, itemInterest, itemDiscount);
            }
            await updateSaleStatus(sale.id, 'completed');
            amount = Math.round((amount - itemTotalDue) * 100) / 100;
          } else {
            // Partial payment for this sale
            if (sale.receivableId && bulkReceiveAccount && markReceivableReceivedPartial) {
              await markReceivableReceivedPartial(sale.receivableId, bulkReceiveAccount, amount, itemInterest, itemDiscount);
              // The system handles the receivable split via events from finance-context
            } else {
              // For the sale itself, we split it manually
              const receiveVal = amount;
              const remainder = itemTotalDue - receiveVal;
              
              const newSalePayload: NewSalePayload = {
                clientName: sale.clientName,
                saleDate: sale.saleDate,
                status: 'pending',
                paymentMethod: sale.paymentMethod,
                notes: (sale.notes ? sale.notes + '\n' : '') + 'Saldo restante da venda original',
                requiresShipping: sale.requiresShipping,
                items: [{ productName: `Saldo Restante (${sale.items.map(i => i.productName).join(', ')})`.substring(0, 50), quantity: 1, unitPrice: remainder, total: remainder }]
              };
              
              await createSale(newSalePayload, false);
              
              // Update original sale to be completed and have only the received amount
              await updateSale(sale.id, {
                items: [{ productName: `Pagamento Parcial (${sale.items.map(i => i.productName).join(', ')})`.substring(0, 50), quantity: 1, unitPrice: receiveVal, total: receiveVal }]
              });
              await updateSaleStatus(sale.id, 'completed');
            }
            
            amount = 0;
          }
        }
      }
      
      setSelectedSales([]);
      setBulkReceiveModal(false);
      setSheetOpen(false);
      resetForm();

      if (items.length > 0) {
        const accName = financeData?.accounts.find(a => a.id === bulkReceiveAccount)?.name || 'Conta';
        const receivedDate = new Date().toISOString().split('T')[0];
        // Open share receipt modal
        const summaryId = items.length === 1 ? items[0].id : `bulk-${Date.now()}`;
        const description = items.length === 1 ? items[0].items.map(i => i.productName).join(', ') : `Pagamento de ${items.length} vendas`;
        const clientName = items.length === 1 ? items[0].clientName : 'Múltiplos Clientes';
        
        let finalReceivedAmount = totalDue;
        if (receivePartialMode) {
          const amt = parseFloat(bulkReceiveAmount) || 0;
          finalReceivedAmount = amt > 0 ? Math.min(amt, totalDue) : totalDue;
        }
        
        
        openShare({
          title: 'Compartilhar Recibo',
          filenameBase: `recibo-vendas-${receivedDate}`,
          generatePDF: () => generateReceiptPDF({
            id: summaryId, clientName: clientName || '', description,
            amount: finalReceivedAmount, receivedDate, accountName: accName,
            interestAmount: totalInterest, discountAmount: totalDiscount
          }, pixSettings),
          generatePNG: () => generateReceiptPNG({
            id: summaryId, clientName: clientName || '', description,
            amount: finalReceivedAmount, receivedDate, accountName: accName,
            interestAmount: totalInterest, discountAmount: totalDiscount
          }, pixSettings),
        });
      }
    } finally { setSaving(false); }
  };

  const handleGenerateReportSelected = () => {
    const items = selectedSales.map(id => sales.find(s => s.id === id)).filter(Boolean) as Sale[];
    if (items.length === 0) return;
    const receivables = items.map(s => ({
      id: s.id, amount: s.total, clientName: s.clientName || 'Sem nome',
      description: s.items.map(i => i.productName).join(', '),
      dueDate: s.saleDate, status: 'pending' as const,
      categoryId: ''
    }));
    openShare({
      title: 'Relatório de Vendas',
      filenameBase: `relatorio-vendas-${fmtDate(new Date().toISOString()).replace(/\//g, '-')}`,
      generatePDF: () => generateReceivablesReportPDF(receivables, pixSettings, 'Relatório de Vendas'),
      generatePNG: () => generateReceivablesReportPNG(receivables, pixSettings, 'Relatório de Vendas'),
    });
  };

  const handleGeneratePixSelected = () => {
    const items = selectedSales.map(id => sales.find(s => s.id === id)).filter(Boolean) as Sale[];
    if (items.length === 0) return;
    if (!isConfigured) { setPixWarningOpen(true); return; }

    const amt = bulkPartialMode && bulkPartialAmount && parseFloat(bulkPartialAmount.replace(/\D/g, '')) / 100 > 0
      ? parseFloat(bulkPartialAmount.replace(/\D/g, '')) / 100
      : items.reduce((sum, i) => sum + i.total, 0);

    const consolidated = {
      id: `sales-${Date.now()}`,
      clientName: Array.from(new Set(items.map(i => i.clientName))).join(', '),
      description: bulkPartialMode ? `Pagamento parcial de ${items.length} vendas` : `Pagamento consolidado de ${items.length} vendas`,
      amount: amt,
      dueDate: new Date().toISOString().split('T')[0]
    };

    openShare({
      title: `Cobrança PIX de Vendas (${items.length} itens)`,
      filenameBase: `pix-vendas-${consolidated.clientName.replace(/\s+/g, '_')}-${consolidated.dueDate}`,
      generatePDF: () => generateChargePDF(consolidated, pixSettings),
      generatePNG: () => generateChargePNG(consolidated, pixSettings),
      pixCopyText: (async () => {
        const { generatePixBRCode } = await import('@/lib/pix');
        return generatePixBRCode({
          pixKey: pixSettings.pixKey,
          pixKeyType: pixSettings.pixKeyType,
          amount: consolidated.amount,
          beneficiaryName: pixSettings.beneficiaryName,
          beneficiaryCity: pixSettings.beneficiaryCity,
          txid: consolidated.id.replace(/-/g, '').substring(0, 25),
          description: consolidated.description,
        });
      })(),
    });
  };

  const handleSelectSale = (id: string, isSelected: boolean) => {
    setSelectedSales(prev => isSelected ? [...prev, id] : prev.filter(x => x !== id));
  };

  const handleEditSale = (sale: Sale) => {
    setEditingSaleId(sale.id);
    setClientName(sale.clientName || '');
    setSaleDate(sale.saleDate);
    setPaymentMethod(sale.paymentMethod || '');
    setNotes(sale.notes || '');
    setSaleDiscountAmount(sale.discountAmount ? String(sale.discountAmount) : '');
    setRequiresShipping(sale.requiresShipping ?? false);
    setCompleteOnSave(sale.status === 'completed');
    setCartItems(sale.items.map((i, idx) => ({ ...i, tmpId: idx.toString() })));
    
    // Restaurar data de vencimento do contas a receber vinculado
    if (sale.receivableId) {
      const rec = financeData.receivables.find(r => r.id === sale.receivableId);
      if (rec) {
        setDueDate(rec.dueDate);
      } else {
        setDueDate(sale.saleDate);
      }
    } else {
      setDueDate(sale.saleDate);
    }
    
    setSheetOpen(true);
  };

  const selectedSalesTotal = useMemo(() => {
    return selectedSales.reduce((acc, id) => {
      const s = sales.find(x => x.id === id);
      return acc + (s?.total || 0);
    }, 0);
  }, [selectedSales, sales]);

  const bulkCalculatedDiscount = receiveDiscountType === 'PERCENT'
    ? selectedSalesTotal * (parseFloat(receiveDiscountAmount) || 0) / 100
    : (parseFloat(receiveDiscountAmount) || 0);

  const bulkFinalTotal = Math.max(0, selectedSalesTotal + (selectedSalesTotal * (parseFloat(receiveInterestPercent) || 0) / 100) - bulkCalculatedDiscount);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 relative pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Vendas</h1>
          <p className="text-muted-foreground text-sm">Registre e acompanhe suas vendas</p>
        </div>
        <Button onClick={() => { resetForm(); setSheetOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Venda
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de Vendas', value: stats.total, icon: ShoppingCart, format: false },
          { label: 'Concluídas', value: stats.completedCount, icon: CheckCircle2, format: false },
          { label: 'Receita no Mês', value: stats.monthRevenue, icon: TrendingUp, format: true },
          { label: 'Ticket Médio', value: stats.avgTicket, icon: Receipt, format: true },
        ].map(s => (
          <div key={s.label} className="finance-card p-4 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-bold text-lg mono">{s.format ? fmt(s.value as number) : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Tabs value={tab} onValueChange={v => setTab(v as 'all' | SaleStatus)} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto flex flex-wrap h-auto">
              <TabsTrigger value="all" className="flex-1 sm:flex-none">Todas</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 sm:flex-none"><Clock className="h-3 w-3 mr-1" />Pendentes</TabsTrigger>
              <TabsTrigger value="completed" className="flex-1 sm:flex-none"><CheckCircle2 className="h-3 w-3 mr-1" />Concluídas</TabsTrigger>
              {sales.some(s => s.requiresShipping) && (
                <>
                  <TabsTrigger value="preparing" className="flex-1 sm:flex-none"><Package className="h-3 w-3 mr-1" />Separar</TabsTrigger>
                  <TabsTrigger value="dispatched" className="flex-1 sm:flex-none"><Truck className="h-3 w-3 mr-1" />Enviadas</TabsTrigger>
                </>
              )}
              <TabsTrigger value="cancelled" className="flex-1 sm:flex-none"><XCircle className="h-3 w-3 mr-1" />Canceladas</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Pagamento..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Formas</SelectItem>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            className="pl-9"
            placeholder="Buscar por cliente..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSearchSuggestions(true); }}
            onFocus={() => setShowSearchSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 150)}
            autoComplete="off"
          />
          {showSearchSuggestions && search.length >= 1 && (() => {
            const suggestions = contacts
              .filter(c => removeAccents(c.name.toLowerCase()).includes(removeAccents(search.toLowerCase())))
              .slice(0, 10);
            return suggestions.length > 0 ? (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
                {suggestions.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                    onMouseDown={() => { setSearch(c.name); setShowSearchSuggestions(false); }}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                  </button>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedSales.length > 0 && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="bg-primary text-primary-foreground shadow-sm rounded-xl px-4 py-3 flex items-center justify-between gap-4 mb-4"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedSales.length} {selectedSales.length === 1 ? 'venda selecionada' : 'vendas selecionadas'}</span>
            <span className="text-primary-foreground/70 hidden sm:inline">Total: {fmt(selectedSalesTotal)}</span>
            
            <div className="flex items-center gap-2 ml-4 bg-primary-foreground/10 px-2 py-1 rounded-md">
              <Checkbox 
                id="bulkPartialSales" 
                className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
                checked={bulkPartialMode}
                onCheckedChange={(checked) => {
                  setBulkPartialMode(checked as boolean);
                  if (checked as boolean && !bulkPartialAmount) setBulkPartialAmount((selectedSalesTotal / 2).toFixed(2).replace('.', ','));
                  if (!checked) setBulkPartialAmount('');
                }}
              />
              <Label htmlFor="bulkPartialSales" className="cursor-pointer text-xs whitespace-nowrap">Parcial</Label>
            </div>
            
            {bulkPartialMode && (
              <div className="flex items-center gap-2 ml-2">
                <Input 
                  value={bulkPartialAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setBulkPartialAmount(val ? (parseInt(val) / 100).toFixed(2).replace('.', ',') : '');
                  }}
                  className="w-24 h-8 bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/50 px-2 text-right text-sm"
                  placeholder="0,00"
                />
                {bulkPartialAmount && (parseFloat(bulkPartialAmount.replace(/\D/g, '')) / 100) > 0 && (parseFloat(bulkPartialAmount.replace(/\D/g, '')) / 100) < selectedSalesTotal && (
                  <span className="text-xs text-primary-foreground/80 whitespace-nowrap">
                    Restante: <strong>{fmt(selectedSalesTotal - (parseFloat(bulkPartialAmount.replace(/\D/g, '')) / 100))}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/20 px-2 sm:px-3"
              onClick={handleGenerateReportSelected} title="Gerar Relatório">
              <Printer className="h-4 w-4 sm:mr-2" /> 
              <span className="hidden sm:inline">Relatório</span>
            </Button>
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/20 px-2 sm:px-3"
              onClick={handleGeneratePixSelected} title="Gerar Pix">
              <QrCode className="h-4 w-4 sm:mr-2" /> 
              <span className="hidden sm:inline">
                {bulkPartialMode && bulkPartialAmount && (parseFloat(bulkPartialAmount.replace(/\D/g, '')) / 100) > 0
                  ? `Pix ${fmt(parseFloat(bulkPartialAmount.replace(/\D/g, '')) / 100)}`
                  : 'Gerar Pix'}
              </span>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedSales([])}>Cancelar</Button>
            <Button size="sm" variant="outline" className="text-primary border-primary-foreground/20 bg-background hover:bg-background/90"
              onClick={() => {
                if (bulkPartialMode && bulkPartialAmount) {
                  setBulkReceiveAmount(bulkPartialAmount);
                } else {
                  setBulkReceiveAmount(selectedSalesTotal.toFixed(2).replace('.', ','));
                }
                setBulkReceivePaymentMethod('keep');
                setBulkReceiveModal(true);
              }}>
              {bulkPartialMode ? 'Receber parcial' : 'Receber'}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Sales List */}
      {loadingSales ? (
        <div className="text-center py-12 text-muted-foreground">Carregando vendas...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhuma venda encontrada</p>
          <Button onClick={() => { resetForm(); setSheetOpen(true); }} variant="outline" size="sm">Registrar primeira venda</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.some(s => s.status === 'pending') && (
            <div className="flex items-center gap-2 px-2 py-1 bg-secondary/20 rounded-md border border-border/50">
              <Checkbox 
                checked={filtered.filter(s => s.status === 'pending').length > 0 && filtered.filter(s => s.status === 'pending').every(s => selectedSales.includes(s.id))} 
                onCheckedChange={(c) => {
                  const pending = filtered.filter(s => s.status === 'pending');
                  if (c) {
                    const toAdd = pending.map(x => x.id).filter(id => !selectedSales.includes(id));
                    setSelectedSales(prev => [...prev, ...toAdd]);
                  } else {
                    const toRemove = pending.map(x => x.id);
                    setSelectedSales(prev => prev.filter(id => !toRemove.includes(id)));
                  }
                }}
                id="select-all-pending"
              />
              <Label htmlFor="select-all-pending" className="text-sm font-medium cursor-pointer flex-1">
                Selecionar todas as pendentes desta lista ({filtered.filter(s => s.status === 'pending').length})
              </Label>
            </div>
          )}
          {filtered.map(sale => (
            <SaleCard
              key={sale.id}
              sale={sale}
              onStatusChange={updateSaleStatus}
              onUpdateShipping={updateSaleShipping}
              onDelete={id => setDeleteId(id)}
              onEdit={handleEditSale}
              onReceive={(s) => {
                setSelectedSales([s.id]);
                setBulkReceiveAmount(s.total.toFixed(2).replace('.', ','));
                setBulkReceivePaymentMethod('keep');
                setBulkReceiveModal(true);
              }}
              selectable={sale.status === 'pending'}
              selected={selectedSales.includes(sale.id)}
              onSelect={handleSelectSale}
            />
          ))}
        </div>
      )}

      {/* New Sale Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (!o) resetForm(); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <SheetHeader className="mb-4">
            <SheetTitle>{editingSaleId ? 'Editar Venda' : 'Nova Venda'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 py-4">
            {/* Client + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cliente</Label>
                <ContactInputWithPicker value={clientName} onChange={setClientName} />
              </div>
              <div>
                <Label>Data da Venda</Label>
                <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Product Search */}
            <div className="space-y-2">
              <Label>Adicionar Produtos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar produto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
              </div>
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {products.filter(p => p.active).length === 0 ? 'Nenhum produto ativo cadastrado' : 'Nenhum produto encontrado'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredProducts.map(p => {
                    const originalSale = editingSaleId ? sales.find(s => s.id === editingSaleId) : null;
                    const originalItem = originalSale?.items.find(i => i.productId === p.id);
                    const originalQty = originalItem ? originalItem.quantity : 0;
                    const cartItem = cartItems.find(i => i.productId === p.id);
                    const inCart = cartItem ? cartItem.quantity : 0;
                    const netAddedQty = inCart - originalQty;
                    const availableQty = p.stockQuantity - netAddedQty;

                    return (
                    <button key={p.id} onClick={() => addToCart(p.id)}
                      className="flex items-center justify-between p-2 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-all text-left gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {p.imageUrl ? (
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            className="w-8 h-8 object-cover rounded-md shrink-0 border border-border" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-secondary/50 flex items-center justify-center shrink-0 border border-border">
                            <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{fmt(p.price)}/{p.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span className={`text-xs ${availableQty <= 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{availableQty}</span>
                      </div>
                    </button>
                  )})}
                </div>
              )}
            </div>

            {/* Cart */}
            {cartItems.length > 0 && (
              <div className="space-y-2">
                <Label>Itens da Venda</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cartItems.map(item => {
                    const prod = products.find(p => p.id === item.productId);
                    return (
                      <div key={item.tmpId} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-border">
                        {prod?.imageUrl ? (
                          <img 
                            src={prod.imageUrl} 
                            alt={item.productName} 
                            className="w-8 h-8 object-cover rounded-md shrink-0 border border-border" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-secondary/50 flex items-center justify-center shrink-0 border border-border">
                            <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground mono">{fmt(item.unitPrice)} × {item.quantity} = {fmt(item.total)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="outline" className="h-7 w-7 text-xs"
                            onClick={() => updateCartQty(item.tmpId, item.quantity - 1)}>−</Button>
                          <Input
                            type="number"
                            step="any"
                            min="0"
                            className="h-7 w-16 px-1 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              if (valStr === '') {
                                updateCartQty(item.tmpId, 0, false);
                              } else {
                                const val = parseFloat(valStr);
                                if (!isNaN(val)) updateCartQty(item.tmpId, val, false);
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val) || val <= 0) {
                                updateCartQty(item.tmpId, 0, true);
                              }
                            }}
                          />
                          <Button size="icon" variant="outline" className="h-7 w-7 text-xs"
                            onClick={() => updateCartQty(item.tmpId, item.quantity + 1)}>+</Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => updateCartQty(item.tmpId, 0, true)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="font-medium mono">{fmt(cartTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-1">
                    <Label className="text-sm shrink-0">Desconto</Label>
                    <div className="flex gap-1">
                      <Input 
                        type="number" step="0.01" min="0" max={saleDiscountType === 'PERCENT' ? 100 : cartTotal}
                        className="w-32 h-8 text-right"
                        value={saleDiscountAmount} 
                        onChange={e => setSaleDiscountAmount(e.target.value)} 
                        placeholder="0,00" 
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 w-12 font-bold text-xs"
                        onClick={() => setSaleDiscountType(prev => prev === 'BRL' ? 'PERCENT' : 'BRL')}
                      >
                        {saleDiscountType === 'BRL' ? 'R$' : '%'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-md bg-primary/10 border border-primary/20">
                    <span className="font-semibold text-sm">Total a Cobrar</span>
                    <span className="font-bold text-lg text-primary mono">{fmt(finalSaleTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label>Observações</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações opcionais..." />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border">
                <div>
                  <Label className="text-sm font-medium">Requer Entrega/Envio</Label>
                  <p className="text-xs text-muted-foreground">O produto passará pelo fluxo de separação e despacho</p>
                </div>
                <Switch checked={requiresShipping} onCheckedChange={setRequiresShipping} />
              </div>

              <div className="p-3 rounded-md bg-secondary/30 border border-border">
                <Label className="text-sm font-medium mb-3 block">Tipo de Venda</Label>
                <RadioGroup 
                  value={completeOnSave ? "vista" : "prazo"} 
                  onValueChange={(v) => setCompleteOnSave(v === "vista")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2 cursor-pointer">
                    <RadioGroupItem value="vista" id="vista" />
                    <Label htmlFor="vista" className="cursor-pointer">À vista</Label>
                  </div>
                  <div className="flex items-center space-x-2 cursor-pointer">
                    <RadioGroupItem value="prazo" id="prazo" />
                    <Label htmlFor="prazo" className="cursor-pointer">À prazo</Label>
                  </div>
                </RadioGroup>
                
                {!completeOnSave && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-border">
                    <Label className="text-xs mb-1.5 block">Data de Vencimento</Label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9" />
                  </motion.div>
                )}

                <p className="text-[10px] text-muted-foreground mt-2">
                  {completeOnSave ? "Conclui a venda e baixa o estoque agora" : "A venda ficará pendente no sistema"}
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border">
                <div>
                  <Label className="text-sm font-medium">
                    {completeOnSave ? 'Lançar receita no financeiro' : 'Criar conta a receber'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {completeOnSave ? 'Gera uma transação imediata na conta' : 'Lança como conta a receber pendente'}
                  </p>
                </div>
                <Switch checked={createReceivable} onCheckedChange={setCreateReceivable} />
              </div>

              {createReceivable && (
                <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-primary/30">
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Select 
                      value={selectedCategoryId} 
                      onValueChange={(v) => {
                        setSelectedCategoryId(v);
                        localStorage.setItem('last_sale_category', v);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria..." /></SelectTrigger>
                      <SelectContent>
                        {incomeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Conta</Label>
                    <Select 
                      value={selectedAccountId} 
                      onValueChange={(v) => {
                        setSelectedAccountId(v);
                        localStorage.setItem('last_sale_account', v);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Conta..." /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleCreateSale} disabled={saving || cartItems.length === 0}>
                {saving ? 'Salvando...' : editingSaleId ? 'Salvar Alterações' : 'Registrar Venda'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirm */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={o => { if (!o) setDeleteId(null); }}
        onConfirm={async () => { if (deleteId) { await deleteSale(deleteId); setDeleteId(null); } }}
        description="Esta venda e seus itens serão excluídos permanentemente."
      />

      {/* Bulk Receive Modal */}
      <Dialog open={bulkReceiveModal} onOpenChange={(o) => { setBulkReceiveModal(o); if (!o) { setBulkReceiveAmount(''); setBulkReceiveAccount(''); } }}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">{selectedSales.length > 1 ? `${selectedSales.length} vendas` : 'Valor original'}</span>
              <span className="text-lg font-bold text-muted-foreground mono">{fmt(selectedSalesTotal)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Juros (%)</Label>
                <Input type="number" step="0.1" min="0" value={receiveInterestPercent} onChange={(e) => setReceiveInterestPercent(e.target.value)} placeholder="0.0" />
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
              <span className="text-xl font-bold text-success mono">
                {fmt(bulkFinalTotal)}
              </span>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Checkbox id="receivePartialMode" checked={receivePartialMode} onCheckedChange={(c) => {
                  const checked = c === true;
                  setReceivePartialMode(checked);
                  if (checked && !bulkReceiveAmount) {
                    setBulkReceiveAmount((bulkFinalTotal / 2).toFixed(2));
                  }
                  if (!checked) setBulkReceiveAmount('');
                }} />
                <Label htmlFor="receivePartialMode" className="cursor-pointer text-sm">
                  Recebimento parcial{selectedSales.length > 1 ? ` (${selectedSales.length} itens)` : ''}
                </Label>
              </div>
              {receivePartialMode && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {selectedSales.length > 1 ? 'Valor recebido agora (FIFO — quita os mais antigos primeiro)' : 'Valor recebido agora'}
                  </Label>
                  <Input type="number" step="0.01" min="0.01" value={bulkReceiveAmount}
                    onChange={(e) => setBulkReceiveAmount(e.target.value)} placeholder="0,00" />
                  <p className="text-xs text-muted-foreground mt-1">O saldo restante de {fmt(Math.max(0, bulkFinalTotal - (parseFloat(bulkReceiveAmount) || 0)))} será criado como uma nova conta pendente.</p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={bulkReceivePaymentMethod} onValueChange={setBulkReceivePaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Manter formas originais</SelectItem>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta de Destino</Label>
              <Select value={bulkReceiveAccount} onValueChange={a => { setBulkReceiveAccount(a); localStorage.setItem('last_sale_account', a); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                <SelectContent>
                  {financeData?.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full mt-4 h-auto whitespace-normal py-2" onClick={handleBulkReceive} disabled={saving || !bulkReceiveAccount}>
              {saving ? 'Processando...' : 'Confirmar Recebimento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pix Config Warning */}
      <AlertDialog open={pixWarningOpen} onOpenChange={setPixWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pix não configurado</AlertDialogTitle>
            <AlertDialogDescription>
              Para gerar cobranças PIX, você precisa configurar sua chave PIX nas configurações do sistema (menu lateral).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setPixWarningOpen(false)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share/Print Document */}
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
    </div>
  );
}
