import { useState, useMemo } from 'react';
import { useSales, NewSaleItem, NewSalePayload } from '@/lib/sales-context';
import { useFinance } from '@/lib/finance-context';
import { Sale, SaleStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { motion } from 'framer-motion';
import {
  Plus, Search, ShoppingCart, Trash2, CheckCircle2, XCircle,
  Clock, TrendingUp, Package, Receipt, ChevronDown, ChevronUp,
} from 'lucide-react';
import { fmt, fmtDate } from '@/lib/format';
import { toast } from 'sonner';

const STATUS_MAP: Record<SaleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:   { label: 'Pendente',   variant: 'outline' },
  completed: { label: 'Concluída',  variant: 'default' },
  cancelled: { label: 'Cancelada',  variant: 'destructive' },
};

const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Cartão Débito', 'Cartão Crédito', 'Boleto', 'Transferência', 'Outro'];

function SaleCard({ sale, onStatusChange, onDelete }: {
  sale: Sale;
  onStatusChange: (id: string, s: SaleStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_MAP[sale.status];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="finance-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
        <div className="flex gap-2">
          {sale.status === 'pending' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-success border-success/40 hover:bg-success/10"
                onClick={() => onStatusChange(sale.id, 'completed')}>
                <CheckCircle2 className="h-3 w-3" /> Concluir
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => onStatusChange(sale.id, 'cancelled')}>
                <XCircle className="h-3 w-3" /> Cancelar
              </Button>
            </>
          )}
          {sale.status === 'completed' && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => onStatusChange(sale.id, 'cancelled')}>
              <XCircle className="h-3 w-3" /> Cancelar
            </Button>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(sale.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export default function SalesPage() {
  const { products, sales, loadingSales, createSale, updateSaleStatus, deleteSale } = useSales();
  const { data: financeData } = useFinance();

  const [tab, setTab] = useState<'all' | SaleStatus>('all');
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New Sale form
  const [clientName, setClientName] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [completeOnSave, setCompleteOnSave] = useState(true);
  const [createReceivable, setCreateReceivable] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [cartItems, setCartItems] = useState<(NewSaleItem & { tmpId: string })[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const incomeCategories = financeData.categories.filter(c => c.type === 'income');
  const accounts = financeData.accounts;

  const filteredProducts = useMemo(() =>
    products.filter(p => p.active && p.name.toLowerCase().includes(productSearch.toLowerCase())),
    [products, productSearch]
  );

  const cartTotal = cartItems.reduce((s, i) => s + i.total, 0);

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

  const filtered = useMemo(() => sales.filter(s => {
    if (tab !== 'all' && s.status !== tab) return false;
    if (search && !s.clientName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [sales, tab, search]);

  const addToCart = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const existing = cartItems.find(i => i.productId === productId);
    if (existing) {
      setCartItems(prev => prev.map(i =>
        i.productId === productId
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
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

  const updateCartQty = (tmpId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems(prev => prev.filter(i => i.tmpId !== tmpId));
    } else {
      setCartItems(prev => prev.map(i =>
        i.tmpId === tmpId ? { ...i, quantity: qty, total: qty * i.unitPrice } : i
      ));
    }
  };

  const resetForm = () => {
    setClientName(''); setSaleDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod(''); setNotes(''); setCompleteOnSave(true);
    setCreateReceivable(false); setCartItems([]); setProductSearch('');
    setSelectedCategoryId(''); setSelectedAccountId('');
  };

  const handleCreateSale = async () => {
    if (cartItems.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    setSaving(true);
    try {
      const payload: NewSalePayload = {
        clientName: clientName || undefined,
        status: completeOnSave ? 'completed' : 'pending',
        paymentMethod: paymentMethod || undefined,
        notes: notes || undefined,
        saleDate,
        items: cartItems,
      };
      await createSale(payload, createReceivable, selectedCategoryId || undefined, selectedAccountId || undefined);
      setSheetOpen(false);
      resetForm();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
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
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={tab} onValueChange={v => setTab(v as any)} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pending"><Clock className="h-3 w-3 mr-1" />Pendentes</TabsTrigger>
            <TabsTrigger value="completed"><CheckCircle2 className="h-3 w-3 mr-1" />Concluídas</TabsTrigger>
            <TabsTrigger value="cancelled"><XCircle className="h-3 w-3 mr-1" />Canceladas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

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
          {filtered.map(sale => (
            <SaleCard
              key={sale.id} sale={sale}
              onStatusChange={updateSaleStatus}
              onDelete={id => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* New Sale Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nova Venda</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 py-4">
            {/* Client + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cliente</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome do cliente" />
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
                  {filteredProducts.map(p => (
                    <button key={p.id} onClick={() => addToCart(p.id)}
                      className="flex items-center justify-between p-2 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-all text-left gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{fmt(p.price)}/{p.unit}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{p.stockQuantity}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            {cartItems.length > 0 && (
              <div className="space-y-2">
                <Label>Itens da Venda</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cartItems.map(item => (
                    <div key={item.tmpId} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground mono">{fmt(item.unitPrice)} × {item.quantity} = {fmt(item.total)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="outline" className="h-6 w-6 text-xs"
                          onClick={() => updateCartQty(item.tmpId, item.quantity - 1)}>−</Button>
                        <span className="text-sm w-8 text-center">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6 text-xs"
                          onClick={() => updateCartQty(item.tmpId, item.quantity + 1)}>+</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center p-3 rounded-md bg-primary/10 border border-primary/20">
                  <span className="font-semibold text-sm">Total</span>
                  <span className="font-bold text-lg text-primary mono">{fmt(cartTotal)}</span>
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
                  <Label className="text-sm font-medium">Concluir venda agora</Label>
                  <p className="text-xs text-muted-foreground">Atualiza estoque imediatamente</p>
                </div>
                <Switch checked={completeOnSave} onCheckedChange={setCompleteOnSave} />
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
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria..." /></SelectTrigger>
                      <SelectContent>
                        {incomeCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Conta</Label>
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
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
                {saving ? 'Salvando...' : 'Registrar Venda'}
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
    </div>
  );
}
