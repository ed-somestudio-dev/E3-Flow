import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Transaction, TransactionType } from '@/lib/types';
import { Plus, Trash2, Edit2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function TransactionsPage() {
  const { data, addTransaction, updateTransaction, deleteTransaction, getCategoryName, getAccountName } = useFinance();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = data.transactions
    .filter(t => typeFilter === 'all' || t.type === typeFilter)
    .filter(t => t.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">Track income and expenses</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingTx(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTx(null)}><Plus className="h-4 w-4 mr-2" />Add Transaction</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingTx ? 'Edit' : 'New'} Transaction</DialogTitle></DialogHeader>
            <TransactionForm
              tx={editingTx}
              categories={data.categories}
              accounts={data.accounts}
              onSave={(tx) => {
                if (editingTx) updateTransaction({ ...tx, id: editingTx.id });
                else addTransaction(tx);
                setDialogOpen(false);
                setEditingTx(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="finance-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Account</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <motion.tr key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 mono text-muted-foreground">{tx.date}</td>
                  <td className="py-3 px-4 font-medium">{tx.description}</td>
                  <td className="py-3 px-4 text-muted-foreground">{getCategoryName(tx.categoryId)}</td>
                  <td className="py-3 px-4 text-muted-foreground">{getAccountName(tx.accountId)}</td>
                  <td className={`py-3 px-4 text-right mono font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTx(tx); setDialogOpen(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTransaction(tx.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TransactionForm({ tx, categories, accounts, onSave }: {
  tx: Transaction | null;
  categories: { id: string; name: string; type: TransactionType }[];
  accounts: { id: string; name: string }[];
  onSave: (t: Omit<Transaction, 'id'>) => void;
}) {
  const [type, setType] = useState<TransactionType>(tx?.type || 'expense');
  const [description, setDescription] = useState(tx?.description || '');
  const [categoryId, setCategoryId] = useState(tx?.categoryId || '');
  const [amount, setAmount] = useState(tx?.amount?.toString() || '');
  const [date, setDate] = useState(tx?.date || new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(tx?.accountId || accounts[0]?.id || '');
  const [notes, setNotes] = useState(tx?.notes || '');

  const filteredCats = categories.filter(c => c.type === type);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => { setType(v as TransactionType); setCategoryId(''); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Transaction description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {filteredCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Amount</Label>
        <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes" />
      </div>
      <Button className="w-full" disabled={!description || !categoryId || !amount || !accountId}
        onClick={() => onSave({ type, description, categoryId, amount: parseFloat(amount), date, accountId, notes: notes || undefined })}>
        {tx ? 'Update' : 'Create'} Transaction
      </Button>
    </div>
  );
}
