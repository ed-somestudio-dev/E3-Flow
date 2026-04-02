import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import { FinancialAccount, AccountType } from '@/lib/types';
import { Plus, Trash2, Edit2, Wallet, PiggyBank, Banknote, CreditCard, ArrowRightLeft, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { fmt, fmtDate } from '@/lib/format';

const typeIcons: Record<AccountType, React.ElementType> = {
  checking: Wallet, savings: PiggyBank, credit_card: CreditCard,
};
const typeLabels: Record<AccountType, string> = {
  checking: 'Conta Corrente', savings: 'Poupança', credit_card: 'Cartão de Crédito',
};

export default function AccountsPage() {
  const { data, addAccount, updateAccount, deleteAccount, transferBetweenAccounts } = useFinance();
  const [editingItem, setEditingItem] = useState<FinancialAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const nonCreditCards = data.accounts.filter(a => a.type !== 'credit_card');
  const creditCards = data.accounts.filter(a => a.type === 'credit_card');
  const totalBalance = nonCreditCards.reduce((s, a) => s + a.balance, 0);
  const totalCreditLimit = creditCards.reduce((s, a) => s + (a.creditLimit || 0), 0);
  const totalCreditUsed = creditCards.reduce((s, a) => s + ((a.creditLimit || 0) - a.balance), 0);

  // Get invoices (faturas) for credit cards from payables
  const cardInvoices = useMemo(() => {
    const map: Record<string, { pending: typeof data.payables; paid: typeof data.payables }> = {};
    data.payables.forEach(p => {
      if (p.supplier?.startsWith('cartao:')) {
        const cardId = p.supplier.replace('cartao:', '');
        if (!map[cardId]) map[cardId] = { pending: [], paid: [] };
        if (p.status === 'paid') map[cardId].paid.push(p);
        else map[cardId].pending.push(p);
      }
    });
    return map;
  }, [data.payables]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contas Financeiras</h1>
          <p className="text-muted-foreground text-sm">Saldo total: <span className="mono font-semibold text-foreground">{fmt(totalBalance)}</span></p>
          {creditCards.length > 0 && (
            <p className="text-muted-foreground text-xs">Limite total: {fmt(totalCreditLimit)} · Utilizado: {fmt(totalCreditUsed)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />Transferir
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Nova'} Conta</DialogTitle></DialogHeader>
              <AccountForm item={editingItem}
                onSave={(a) => { if (editingItem) updateAccount({ ...a, id: editingItem.id } as FinancialAccount); else addAccount(a); setDialogOpen(false); setEditingItem(null); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Regular accounts */}
      {nonCreditCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {nonCreditCards.map(acc => {
            const Icon = typeIcons[acc.type] || Wallet;
            return (
              <motion.div key={acc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="finance-card relative group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: acc.color + '20' }}>
                      <Icon className="h-4 w-4" style={{ color: acc.color }} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{typeLabels[acc.type]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(acc); setDialogOpen(true); }}><Edit2 className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAccount(acc.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <p className="finance-stat mono">{fmt(acc.balance)}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Credit Cards Section */}
      {creditCards.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Cartões de Crédito
          </h2>
          {creditCards.map(acc => {
            const invoices = cardInvoices[acc.id] || { pending: [], paid: [] };
            const usedAmount = acc.creditLimit ? acc.creditLimit - acc.balance : 0;
            const usedPercent = acc.creditLimit ? Math.min(100, (usedAmount / acc.creditLimit) * 100) : 0;

            return (
              <motion.div key={acc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="finance-card relative group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: acc.color + '20' }}>
                      <CreditCard className="h-4 w-4" style={{ color: acc.color }} />
                    </div>
                    <div>
                      <p className="font-medium">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {acc.billingCloseDay && acc.dueDay
                          ? `Fecha dia ${acc.billingCloseDay} · Vence dia ${acc.dueDay}`
                          : 'Cartão de Crédito'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(acc); setDialogOpen(true); }}><Edit2 className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAccount(acc.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>

                {/* Limit bar */}
                {acc.creditLimit && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Limite Disponível</span>
                      <span className="mono font-semibold">{fmt(acc.balance)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${usedPercent > 80 ? 'bg-destructive' : usedPercent > 50 ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${usedPercent}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Utilizado: {fmt(usedAmount)}</span>
                      <span>Limite: {fmt(acc.creditLimit)}</span>
                    </div>
                  </div>
                )}

                {/* Pending invoices */}
                {invoices.pending.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5 text-primary" />
                      Faturas Pendentes
                    </h4>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {invoices.pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(inv => (
                        <div key={inv.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                          <div>
                            <span className="font-medium">{inv.description}</span>
                            {inv.status === 'overdue' && <span className="ml-1 text-xs text-destructive font-semibold">(Vencida)</span>}
                          </div>
                          <div className="text-right">
                            <span className="mono font-semibold text-destructive">{fmt(inv.amount)}</span>
                            <p className="text-xs text-muted-foreground">{inv.status === 'overdue' ? 'Venceu' : 'Vence'} {fmtDate(inv.dueDate)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paid invoices */}
                {invoices.paid.length > 0 && (
                  <div className="mt-3">
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                        {invoices.paid.length} fatura(s) paga(s)
                      </summary>
                      <div className="space-y-1 mt-2">
                        {invoices.paid.sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map(inv => (
                          <div key={inv.id} className="flex items-center justify-between text-xs p-1.5 text-muted-foreground">
                            <span>{inv.description}</span>
                            <span className="mono">{fmt(inv.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transferência entre Contas</DialogTitle></DialogHeader>
          <TransferForm accounts={data.accounts} onTransfer={(from, to, amount) => {
            transferBetweenAccounts(from, to, amount);
            setTransferOpen(false);
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransferForm({ accounts, onTransfer }: {
  accounts: FinancialAccount[];
  onTransfer: (fromId: string, toId: string, amount: number) => void;
}) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');

  const fromAccount = accounts.find(a => a.id === fromId);
  const isValid = fromId && toId && fromId !== toId && parseFloat(amount) > 0;

  return (
    <div className="space-y-4">
      <div><Label>Conta de Origem</Label>
        <Select value={fromId} onValueChange={setFromId}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {fmt(a.balance)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Conta de Destino</Label>
        <Select value={toId} onValueChange={setToId}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>{accounts.filter(a => a.id !== fromId).map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {fmt(a.balance)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Valor</Label>
        <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
        {fromAccount && <p className="text-xs text-muted-foreground mt-1">Saldo disponível: {fmt(fromAccount.balance)}</p>}
      </div>
      <Button className="w-full" disabled={!isValid} onClick={() => onTransfer(fromId, toId, parseFloat(amount))}>
        <ArrowRightLeft className="h-4 w-4 mr-2" />Transferir
      </Button>
    </div>
  );
}

function AccountForm({ item, onSave }: {
  item: FinancialAccount | null; onSave: (a: Omit<FinancialAccount, 'id'>) => void;
}) {
  const [name, setName] = useState(item?.name || '');
  const [type, setType] = useState<AccountType>(item?.type || 'checking');
  const [balance, setBalance] = useState(item?.balance?.toString() || '0');
  const [creditLimit, setCreditLimit] = useState(item?.creditLimit?.toString() || '');
  const [billingCloseDay, setBillingCloseDay] = useState(item?.billingCloseDay?.toString() || '');
  const [dueDay, setDueDay] = useState(item?.dueDay?.toString() || '');
  const colors = ['#0ea5e9', '#10b981', '#eab308', '#ef4444', '#8b5cf6', '#f97316'];
  const [color, setColor] = useState(item?.color || colors[0]);

  return (
    <div className="space-y-4">
      <div><Label>Nome da Conta</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da conta" /></div>
      <div><Label>Tipo</Label>
        <Select value={type} onValueChange={v => setType(v as AccountType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {type === 'credit_card' ? (
        <>
          <div><Label>Limite de Crédito</Label><Input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="Ex: 5000" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Dia Fechamento</Label><Input type="number" min="1" max="31" value={billingCloseDay} onChange={e => setBillingCloseDay(e.target.value)} placeholder="Ex: 15" /></div>
            <div><Label>Dia Vencimento</Label><Input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="Ex: 10" /></div>
          </div>
        </>
      ) : (
        <div><Label>Saldo</Label><Input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} /></div>
      )}
      <div><Label>Cor</Label>
        <div className="flex gap-2 mt-1">
          {colors.map(c => (
            <button key={c} className={`w-7 h-7 rounded-full border-2 transition-transform ${c === color ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={!name || (type === 'credit_card' && !creditLimit)}
        onClick={() => onSave({
          name, type, color,
          balance: type === 'credit_card' ? parseFloat(creditLimit || '0') : parseFloat(balance),
          creditLimit: type === 'credit_card' ? parseFloat(creditLimit) : undefined,
          billingCloseDay: type === 'credit_card' && billingCloseDay ? parseInt(billingCloseDay) : undefined,
          dueDay: type === 'credit_card' && dueDay ? parseInt(dueDay) : undefined,
        })}>
        {item ? 'Atualizar' : 'Criar'} Conta
      </Button>
    </div>
  );
}
