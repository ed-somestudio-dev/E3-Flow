import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { FinancialAccount, AccountType } from '@/lib/types';
import { Plus, Trash2, Edit2, Wallet, PiggyBank, Banknote, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const typeIcons: Record<AccountType, React.ElementType> = {
  checking: Wallet, savings: PiggyBank, cash: Banknote, credit_card: CreditCard,
};
const typeLabels: Record<AccountType, string> = {
  checking: 'Checking', savings: 'Savings', cash: 'Cash', credit_card: 'Credit Card',
};

export default function AccountsPage() {
  const { data, addAccount, updateAccount, deleteAccount } = useFinance();
  const [editingItem, setEditingItem] = useState<FinancialAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalBalance = data.accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financial Accounts</h1>
          <p className="text-muted-foreground text-sm">Total balance: <span className="mono font-semibold text-foreground">{fmt(totalBalance)}</span></p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'New'} Account</DialogTitle></DialogHeader>
            <AccountForm
              item={editingItem}
              onSave={(a) => {
                if (editingItem) updateAccount({ ...a, id: editingItem.id } as FinancialAccount);
                else addAccount(a);
                setDialogOpen(false);
                setEditingItem(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.accounts.map(acc => {
          const Icon = typeIcons[acc.type];
          return (
            <motion.div key={acc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="finance-card relative group">
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(acc); setDialogOpen(true); }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAccount(acc.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="finance-stat mono">{fmt(acc.balance)}</p>
              {acc.type === 'credit_card' && acc.creditLimit && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Used</span>
                    <span>{fmt(acc.creditLimit - acc.balance)} / {fmt(acc.creditLimit)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ((acc.creditLimit - acc.balance) / acc.creditLimit) * 100)}%` }} />
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AccountForm({ item, onSave }: {
  item: FinancialAccount | null;
  onSave: (a: Omit<FinancialAccount, 'id'>) => void;
}) {
  const [name, setName] = useState(item?.name || '');
  const [type, setType] = useState<AccountType>(item?.type || 'checking');
  const [balance, setBalance] = useState(item?.balance?.toString() || '0');
  const [creditLimit, setCreditLimit] = useState(item?.creditLimit?.toString() || '');
  const colors = ['#0ea5e9', '#10b981', '#eab308', '#ef4444', '#8b5cf6', '#f97316'];
  const [color, setColor] = useState(item?.color || colors[0]);

  return (
    <div className="space-y-4">
      <div><Label>Account Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Account name" /></div>
      <div>
        <Label>Type</Label>
        <Select value={type} onValueChange={v => setType(v as AccountType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Balance</Label><Input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} /></div>
      {type === 'credit_card' && (
        <div><Label>Credit Limit</Label><Input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} /></div>
      )}
      <div>
        <Label>Color</Label>
        <div className="flex gap-2 mt-1">
          {colors.map(c => (
            <button key={c} className={`w-7 h-7 rounded-full border-2 transition-transform ${c === color ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={!name}
        onClick={() => onSave({ name, type, balance: parseFloat(balance), color, creditLimit: type === 'credit_card' ? parseFloat(creditLimit) : undefined })}>
        {item ? 'Update' : 'Create'} Account
      </Button>
    </div>
  );
}
