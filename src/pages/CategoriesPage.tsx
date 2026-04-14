import { useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Category, TransactionType } from '@/lib/types';
import { Plus, Trash2, Edit2, Search } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';

const typeLabels: Record<TransactionType, string> = { income: 'Receita', expense: 'Despesa' };

export default function CategoriesPage() {
  const { data, addCategory, updateCategory, deleteCategory } = useFinance();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = data.categories
    .filter(c => typeFilter === 'all' || c.type === typeFilter)
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas categorias de receitas e despesas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingItem(null)}><Plus className="h-4 w-4 mr-2" />Nova Categoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingItem ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
            <CategoryForm item={editingItem}
              onSave={(c) => {
                if (editingItem) updateCategory({ ...c, id: editingItem.id } as Category);
                else addCategory(c);
                setDialogOpen(false);
                setEditingItem(null);
              }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar categorias..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(cat => (
          <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="finance-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
              <div>
                <p className="font-medium text-sm">{cat.name}</p>
                <p className="text-xs text-muted-foreground">{typeLabels[cat.type as TransactionType]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => { setEditingItem(cat); setDialogOpen(true); }}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteId(cat.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground col-span-full py-12">Nenhuma categoria encontrada</p>
        )}
      </div>
      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={() => { if (deleteId) { deleteCategory(deleteId); setDeleteId(null); } }}
        title="Excluir categoria?" description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita." />
    </div>
  );
}

const colorOptions = [
  '#0ea5e9', '#8b5cf6', '#10b981', '#6366f1', '#f97316',
  '#eab308', '#ef4444', '#14b8a6', '#3b82f6', '#a855f7',
  '#78716c', '#ec4899', '#84cc16', '#f43f5e', '#06b6d4',
];

function CategoryForm({ item, onSave }: {
  item: Category | null;
  onSave: (c: Omit<Category, 'id'>) => void;
}) {
  const [name, setName] = useState(item?.name || '');
  const [type, setType] = useState<TransactionType>(item?.type as TransactionType || 'expense');
  const [color, setColor] = useState(item?.color || '#0ea5e9');
  const [icon, setIcon] = useState(item?.icon || 'Circle');

  return (
    <div className="space-y-4">
      <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da categoria" /></div>
      <div><Label>Tipo</Label>
        <Select value={type} onValueChange={v => setType(v as TransactionType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {colorOptions.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={!name}
        onClick={() => onSave({ name, type, color, icon })}>
        {item ? 'Atualizar' : 'Criar'} Categoria
      </Button>
    </div>
  );
}
