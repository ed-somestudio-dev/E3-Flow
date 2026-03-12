import { useState, useMemo } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Budget } from '@/lib/types';
import { Plus, Trash2, Edit2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function BudgetsPage() {
  const { data, addBudget, updateBudget, deleteBudget, getCategoryName, getCategoryColor } = useFinance();
  const [editingItem, setEditingItem] = useState<Budget | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(currentMonth);

  const monthBudgets = data.budgets.filter(b => b.month === month);

  const spending = useMemo(() => {
    const map: Record<string, number> = {};
    data.transactions.filter(t => t.type === 'expense' && t.date.startsWith(month)).forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return map;
  }, [data.transactions, month]);

  const expenseCategories = data.categories.filter(c => c.type === 'expense');
  const usedCategoryIds = monthBudgets.map(b => b.categoryId);
  const availableCategories = expenseCategories.filter(c => !usedCategoryIds.includes(c.id));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Budget Management</h1>
          <p className="text-muted-foreground text-sm">Set and track monthly budgets</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-[180px]" />
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingItem(null)} disabled={availableCategories.length === 0}>
                <Plus className="h-4 w-4 mr-2" />Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'New'} Budget</DialogTitle></DialogHeader>
              <BudgetForm
                item={editingItem}
                categories={editingItem ? expenseCategories : availableCategories}
                month={month}
                onSave={(b) => {
                  if (editingItem) updateBudget({ ...b, id: editingItem.id } as Budget);
                  else addBudget(b);
                  setDialogOpen(false);
                  setEditingItem(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {monthBudgets.map(budget => {
          const spent = spending[budget.categoryId] || 0;
          const pct = Math.min(100, (spent / budget.amount) * 100);
          const over = spent > budget.amount;
          const nearLimit = pct >= 80 && !over;
          const catColor = getCategoryColor(budget.categoryId);

          return (
            <motion.div key={budget.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`finance-card ${over ? 'border-destructive/30' : nearLimit ? 'border-warning/30' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: catColor }} />
                  <span className="font-medium">{getCategoryName(budget.categoryId)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {(over || nearLimit) && <AlertTriangle className={`h-4 w-4 ${over ? 'text-destructive' : 'text-warning'}`} />}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(budget); setDialogOpen(true); }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteBudget(budget.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="mono font-semibold">{fmt(spent)}</span>
                <span className="text-muted-foreground">of {fmt(budget.amount)}</span>
              </div>
              <Progress value={pct} className="h-2" />
              {over && <p className="text-xs text-destructive mt-2">Over budget by {fmt(spent - budget.amount)}</p>}
              {nearLimit && <p className="text-xs text-warning mt-2">Approaching limit ({Math.round(pct)}% used)</p>}
            </motion.div>
          );
        })}
        {monthBudgets.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground finance-card">
            No budgets set for this month
          </div>
        )}
      </div>
    </div>
  );
}

function BudgetForm({ item, categories, month, onSave }: {
  item: Budget | null;
  categories: { id: string; name: string }[];
  month: string;
  onSave: (b: Omit<Budget, 'id'>) => void;
}) {
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');

  return (
    <div className="space-y-4">
      <div>
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId} disabled={!!item}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Budget Amount</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
      <Button className="w-full" disabled={!categoryId || !amount}
        onClick={() => onSave({ categoryId, amount: parseFloat(amount), month })}>
        {item ? 'Update' : 'Create'} Budget
      </Button>
    </div>
  );
}
