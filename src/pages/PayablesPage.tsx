import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Payable, PayableStatus } from '@/lib/types';
import { Plus, Trash2, Edit2, CheckCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function StatusBadge({ status }: { status: PayableStatus }) {
  const cls = status === 'paid' ? 'status-badge-paid' : status === 'overdue' ? 'status-badge-overdue' : 'status-badge-pending';
  return <span className={cls}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

export default function PayablesPage() {
  const { data, addPayable, updatePayable, deletePayable, markPayablePaid, getCategoryName } = useFinance();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<Payable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = data.payables
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => p.description.toLowerCase().includes(search.toLowerCase()) || p.supplier.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Accounts Payable</h1>
          <p className="text-muted-foreground text-sm">Manage bills and expenses</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Add Bill</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'New'} Bill</DialogTitle></DialogHeader>
            <PayableForm
              item={editingItem}
              categories={data.categories.filter(c => c.type === 'expense')}
              onSave={(p) => {
                if (editingItem) updatePayable({ ...p, id: editingItem.id } as Payable);
                else addPayable(p);
                setDialogOpen(false);
                setEditingItem(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="finance-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Due Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 mono text-muted-foreground">{p.dueDate}</td>
                  <td className="py-3 px-4 font-medium">{p.description}</td>
                  <td className="py-3 px-4 text-muted-foreground">{p.supplier}</td>
                  <td className="py-3 px-4 text-muted-foreground">{getCategoryName(p.categoryId)}</td>
                  <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                  <td className="py-3 px-4 text-right mono font-semibold text-destructive">{fmt(p.amount)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status !== 'paid' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={() => markPayablePaid(p.id)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingItem(p); setDialogOpen(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deletePayable(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No bills found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PayableForm({ item, categories, onSave }: {
  item: Payable | null;
  categories: { id: string; name: string }[];
  onSave: (p: Omit<Payable, 'id'>) => void;
}) {
  const [description, setDescription] = useState(item?.description || '');
  const [supplier, setSupplier] = useState(item?.supplier || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [dueDate, setDueDate] = useState(item?.dueDate || '');
  const [notes, setNotes] = useState(item?.notes || '');

  return (
    <div className="space-y-4">
      <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Bill description" /></div>
      <div><Label>Supplier</Label><Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      </div>
      <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
      <div><Label>Notes (optional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <Button className="w-full" disabled={!description || !supplier || !categoryId || !amount || !dueDate}
        onClick={() => onSave({ description, supplier, categoryId, amount: parseFloat(amount), dueDate, status: item?.status || 'pending', notes: notes || undefined })}>
        {item ? 'Update' : 'Create'} Bill
      </Button>
    </div>
  );
}
