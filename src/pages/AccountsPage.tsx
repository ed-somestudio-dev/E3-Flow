import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import { FinancialAccount, AccountType, getAccountTypes, hasAccountType } from '@/lib/types';
import { Plus, Trash2, Edit2, Wallet, PiggyBank, Banknote, CreditCard, ArrowRightLeft, Receipt } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { fmt, fmtDate } from '@/lib/format';

const typeIcons: Record<AccountType, React.ElementType> = {
  checking: Wallet, savings: PiggyBank, cash: Banknote, credit_card: CreditCard,
};
const typeLabels: Record<AccountType, string> = {
  checking: 'Conta Corrente', savings: 'Poupança', cash: 'Dinheiro', credit_card: 'Cartão de Crédito',
};

export default function AccountsPage() {
  const { data, addAccount, updateAccount, deleteAccount, transferBetweenAccounts } = useFinance();
  const [editingItem, setEditingItem] = useState<FinancialAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const totalBalance = data.accounts.reduce((s, a) => s + a.balance + a.savingsBalance, 0);
  const totalCreditLimit = data.accounts.reduce((s, a) => s + (hasAccountType(a, 'credit_card') ? (a.creditLimit || 0) : 0), 0);
  const totalCreditUsed = data.accounts.reduce((s, a) => {
    if (!hasAccountType(a, 'credit_card') || !a.creditLimit) return s;
    return s + (a.creditLimit - (hasAccountType(a, 'checking') || hasAccountType(a, 'savings') ? 0 : a.balance));
  }, 0);

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
          <p className="text-muted-foreground text-sm">
            Saldo total: <span className="mono font-semibold text-foreground">{fmt(totalBalance)}</span>
          </p>
          {totalCreditLimit > 0 && (
            <p className="text-muted-foreground text-xs">
              Limite de crédito total: {fmt(totalCreditLimit)}
            </p>
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
                onSave={(a) => {
                  if (editingItem) updateAccount({ ...a, id: editingItem.id } as FinancialAccount);
                  else addAccount(a);
                  setDialogOpen(false); setEditingItem(null);
                }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* All accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.accounts.map(acc => {
          const types = getAccountTypes(acc);
          const hasCreditCard = types.includes('credit_card');
          const hasChecking = types.includes('checking');
          const hasSavings = types.includes('savings');
          const hasCash = types.includes('cash');
          const invoices = cardInvoices[acc.id] || { pending: [], paid: [] };
          const usedFromPayables = hasCreditCard ? invoices.pending.reduce((s, p) => s + p.amount, 0) : 0;
          const usedInitial = hasCreditCard ? (acc.creditUsed || 0) : 0;
          const usedAmount = usedFromPayables + usedInitial;
          const totalLimit = hasCreditCard && acc.creditLimit ? acc.creditLimit : 0;
          const availableAmount = totalLimit - usedAmount;
          const availablePercent = totalLimit > 0 ? Math.max(0, Math.min(100, (availableAmount / totalLimit) * 100)) : 0;

          return (
            <motion.div key={acc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="finance-card relative group col-span-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: acc.color + '20' }}>
                    {hasCreditCard ? <CreditCard className="h-4 w-4" style={{ color: acc.color }} /> :
                     hasChecking ? <Wallet className="h-4 w-4" style={{ color: acc.color }} /> :
                     hasSavings ? <PiggyBank className="h-4 w-4" style={{ color: acc.color }} /> :
                     <Banknote className="h-4 w-4" style={{ color: acc.color }} />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{acc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {types.map(t => typeLabels[t]).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(acc); setDialogOpen(true); }}><Edit2 className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(acc.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>

              {/* Sub-balances */}
              <div className="space-y-2">
                {(hasChecking || hasCash) && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wallet className="h-3 w-3" /> {hasChecking ? 'Conta Corrente' : 'Dinheiro'}
                    </span>
                    <span className="mono font-semibold text-sm">{fmt(acc.balance)}</span>
                  </div>
                )}
                {hasSavings && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <PiggyBank className="h-3 w-3" /> Poupança
                    </span>
                    <span className="mono font-semibold text-sm">{fmt(acc.savingsBalance)}</span>
                  </div>
                )}
                {hasCreditCard && acc.creditLimit != null && acc.creditLimit > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> Limite Total
                      </span>
                      <span className="mono font-semibold text-sm">{fmt(totalLimit)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all bg-primary"
                        style={{ width: `${availablePercent}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Disponível: {fmt(availableAmount)}</span>
                      <span>Utilizado: {fmt(usedAmount)}</span>
                    </div>
                    {acc.billingCloseDay && acc.dueDay && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Fecha dia {acc.billingCloseDay} · Vence dia {acc.dueDay}
                      </p>
                    )}
                  </div>
                )}
                {!hasChecking && !hasCash && !hasSavings && !hasCreditCard && (
                  <p className="finance-stat mono">{fmt(acc.balance)}</p>
                )}
              </div>

            </motion.div>
          );
        })}
      </div>

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

const allTypes: { key: AccountType; label: string }[] = [
  { key: 'checking', label: 'Conta Corrente' },
  { key: 'savings', label: 'Poupança' },
  { key: 'credit_card', label: 'Cartão de Crédito' },
  { key: 'cash', label: 'Dinheiro' },
];

function AccountForm({ item, onSave }: {
  item: FinancialAccount | null; onSave: (a: Omit<FinancialAccount, 'id'>) => void;
}) {
  const existingTypes = item ? getAccountTypes(item) : ['checking' as AccountType];
  const [name, setName] = useState(item?.name || '');
  const [selectedTypes, setSelectedTypes] = useState<AccountType[]>(existingTypes);
  const [balance, setBalance] = useState(item?.balance?.toString() || '0');
  const [savingsBalance, setSavingsBalance] = useState(item?.savingsBalance?.toString() || '0');
  const [creditLimit, setCreditLimit] = useState(item?.creditLimit?.toString() || '');
  const [creditUsed, setCreditUsed] = useState(item?.creditUsed?.toString() || '0');
  const [billingCloseDay, setBillingCloseDay] = useState(item?.billingCloseDay?.toString() || '');
  const [dueDay, setDueDay] = useState(item?.dueDay?.toString() || '');
  const colors = ['#0ea5e9', '#10b981', '#eab308', '#ef4444', '#8b5cf6', '#f97316'];
  const [color, setColor] = useState(item?.color || colors[0]);

  const toggleType = (t: AccountType) => {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const hasCreditCard = selectedTypes.includes('credit_card');
  const hasChecking = selectedTypes.includes('checking') || selectedTypes.includes('cash');
  const hasSavings = selectedTypes.includes('savings');

  return (
    <div className="space-y-4">
      <div><Label>Nome da Conta</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Banco Itaú" /></div>
      <div>
        <Label>Tipos (selecione um ou mais)</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {allTypes.map(t => (
            <label key={t.key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedTypes.includes(t.key) ? 'border-primary bg-primary/10' : 'border-muted'}`}>
              <Checkbox checked={selectedTypes.includes(t.key)} onCheckedChange={() => toggleType(t.key)} />
              <span className="text-sm">{t.label}</span>
            </label>
          ))}
        </div>
      </div>
      {hasChecking && (
        <div><Label>Saldo {selectedTypes.includes('checking') ? 'Conta Corrente' : 'Dinheiro'}</Label>
          <Input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} />
        </div>
      )}
      {hasSavings && (
        <div><Label>Saldo Poupança</Label>
          <Input type="number" step="0.01" value={savingsBalance} onChange={e => setSavingsBalance(e.target.value)} />
        </div>
      )}
      {hasCreditCard && (
        <>
          <div><Label>Limite de Crédito</Label><Input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="Ex: 5000" /></div>
          <div><Label>Limite Utilizado</Label><Input type="number" step="0.01" value={creditUsed} onChange={e => setCreditUsed(e.target.value)} placeholder="Ex: 1500" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Dia Fechamento</Label><Input type="number" min="1" max="31" value={billingCloseDay} onChange={e => setBillingCloseDay(e.target.value)} placeholder="Ex: 15" /></div>
            <div><Label>Dia Vencimento</Label><Input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="Ex: 10" /></div>
          </div>
        </>
      )}
      <div><Label>Cor</Label>
        <div className="flex gap-2 mt-1">
          {colors.map(c => (
            <button key={c} className={`w-7 h-7 rounded-full border-2 transition-transform ${c === color ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={!name || selectedTypes.length === 0 || (hasCreditCard && !creditLimit)}
        onClick={() => onSave({
          name,
          type: selectedTypes.join(','),
          color,
          balance: hasChecking ? parseFloat(balance || '0') : 0,
          savingsBalance: hasSavings ? parseFloat(savingsBalance) : 0,
          creditLimit: hasCreditCard ? parseFloat(creditLimit) : undefined,
          creditUsed: hasCreditCard ? parseFloat(creditUsed || '0') : undefined,
          billingCloseDay: hasCreditCard && billingCloseDay ? parseInt(billingCloseDay) : undefined,
          dueDay: hasCreditCard && dueDay ? parseInt(dueDay) : undefined,
        })}>
        {item ? 'Atualizar' : 'Criar'} Conta
      </Button>
    </div>
  );
}
