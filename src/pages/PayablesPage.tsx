import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Payable, PayableStatus, RecurrenceFrequency } from '@/lib/types';
import { Plus, Trash2, Edit2, CheckCircle, Search, RefreshCw, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import { fmt, fmtDate } from '@/lib/format';

const statusLabels: Record<PayableStatus, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencida' };

function StatusBadge({ status }: { status: PayableStatus }) {
  const cls = status === 'paid' ? 'status-badge-paid' : status === 'overdue' ? 'status-badge-overdue text-destructive font-semibold' : 'status-badge-pending';
  return <span className={cls}>{statusLabels[status]}</span>;
}

export default function PayablesPage() {
  const { data, addPayable, updatePayable, deletePayable, markPayablePaid, getCategoryName, getAccountName } = useFinance();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<Payable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAccountId, setPayAccountId] = useState('');

  const filtered = data.payables
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => p.description.toLowerCase().includes(search.toLowerCase()) || p.supplier.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const handleMarkPaid = (id: string) => {
    const payable = data.payables.find(p => p.id === id);
    if (payable?.accountId) {
      markPayablePaid(id, payable.accountId);
    } else {
      setPayingId(id);
      setPayAccountId(data.accounts[0]?.id || '');
      setPayDialogOpen(true);
    }
  };

  const confirmPay = () => {
    if (payingId && payAccountId) {
      markPayablePaid(payingId, payAccountId);
      setPayDialogOpen(false);
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{'Contas a\u00A0Pagar'}</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas despesas e contas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Nova'} Conta a Pagar</DialogTitle></DialogHeader>
            <PayableForm item={editingItem} categories={data.categories.filter(c => c.type === 'expense')} accounts={data.accounts}
              onSave={(p) => { if (editingItem) updatePayable({ ...p, id: editingItem.id } as Payable); else addPayable(p); setDialogOpen(false); setEditingItem(null); }} />
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
      <div className="finance-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
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
              {filtered.map(p => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 mono text-muted-foreground">{fmtDate(p.dueDate)}</td>
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-1.5">
                      {p.description}
                      {p.recurring && <RefreshCw className="h-3 w-3 text-primary" />}
                      {p.supplier?.startsWith('cartao:') && <CreditCard className="h-3 w-3 text-primary" />}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{p.supplier?.startsWith('cartao:') ? 'Fatura Cartão' : p.supplier}</td>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deletePayable(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma conta encontrada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay dialog - select account */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Selecionar Conta para Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Conta</Label>
              <Select value={payAccountId} onValueChange={setPayAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                <SelectContent>{data.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!payAccountId} onClick={confirmPay}>Confirmar Pagamento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayableForm({ item, categories, accounts, onSave }: {
  item: Payable | null; categories: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  onSave: (p: Omit<Payable, 'id'>) => void;
}) {
  const [description, setDescription] = useState(item?.description || '');
  const [supplier, setSupplier] = useState(item?.supplier || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [accountId, setAccountId] = useState(item?.accountId || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [dueDate, setDueDate] = useState(item?.dueDate || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [recurring, setRecurring] = useState(item?.recurring || false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>(item?.recurrenceFrequency || 'monthly');

  return (
    <div className="space-y-4">
      <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição da conta" /></div>
      <div><Label>Fornecedor</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nome do fornecedor" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Categoria</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Conta</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Valor</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="recurring" checked={recurring} onCheckedChange={(c) => setRecurring(c === true)} />
        <Label htmlFor="recurring" className="cursor-pointer">Conta recorrente</Label>
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

      <div><Label>Notas (opcional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <Button className="w-full" disabled={!description || !supplier || !categoryId || !amount || !dueDate}
        onClick={() => onSave({
          description, supplier, categoryId, accountId: accountId || undefined, amount: parseFloat(amount), dueDate,
          status: item?.status || 'pending', notes: notes || undefined,
          recurring: recurring || undefined,
          recurrenceFrequency: recurring ? recurrenceFrequency : undefined,
        })}>
        {item ? 'Atualizar' : 'Criar'} Conta
      </Button>
    </div>
  );
}
