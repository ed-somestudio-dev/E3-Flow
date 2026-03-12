import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Receivable, ReceivableStatus } from '@/lib/types';
import { Plus, Trash2, Edit2, CheckCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function StatusBadge({ status }: { status: ReceivableStatus }) {
  const cls = status === 'received' ? 'status-badge-paid' : status === 'overdue' ? 'status-badge-overdue' : 'status-badge-pending';
  const label = status === 'received' ? 'Received' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={cls}>{label}</span>;
}

export default function ReceivablesPage() {
  const { data, addReceivable, updateReceivable, deleteReceivable, markReceivableReceived, getCategoryName } = useFinance();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<Receivable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = data.receivables
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => r.description.toLowerCase().includes(search.toLowerCase()) || r.clientName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Accounts Receivable</h1>
          <p className="text-muted-foreground text-sm">Manage incoming payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Add Receivable</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'New'} Receivable</DialogTitle></DialogHeader>
            <ReceivableForm
              item={editingItem}
              categories={data.categories.filter(c => c.type === 'income')}
              onSave={(r) => {
                if (editingItem) updateReceivable({ ...r, id: editingItem.id } as Receivable);
                else addReceivable(r);
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
          <Input placeholder="Search receivables..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="received">Received</SelectItem>
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
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Client</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 mono text-muted-foreground">{r.dueDate}</td>
                  <td className="py-3 px-4 font-medium">{r.clientName}</td>
                  <td className="py-3 px-4 text-muted-foreground">{r.description}</td>
                  <td className="py-3 px-4 text-muted-foreground">{getCategoryName(r.categoryId)}</td>
                  <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                  <td className="py-3 px-4 text-right mono font-semibold text-success">{fmt(r.amount)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== 'received' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success" onClick={() => markReceivableReceived(r.id)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingItem(r); setDialogOpen(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteReceivable(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No receivables found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReceivableForm({ item, categories, onSave }: {
  item: Receivable | null;
  categories: { id: string; name: string }[];
  onSave: (r: Omit<Receivable, 'id'>) => void;
}) {
  const [clientName, setClientName] = useState(item?.clientName || '');
  const [description, setDescription] = useState(item?.description || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [amount, setAmount] = useState(item?.amount?.toString() || '');
  const [dueDate, setDueDate] = useState(item?.dueDate || '');
  const [notes, setNotes] = useState(item?.notes || '');

  return (
    <div className="space-y-4">
      <div><Label>Client Name</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name" /></div>
      <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" /></div>
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
      <Button className="w-full" disabled={!clientName || !description || !categoryId || !amount || !dueDate}
        onClick={() => onSave({ clientName, description, categoryId, amount: parseFloat(amount), dueDate, status: item?.status || 'pending', notes: notes || undefined })}>
        {item ? 'Update' : 'Create'} Receivable
      </Button>
    </div>
  );
}
