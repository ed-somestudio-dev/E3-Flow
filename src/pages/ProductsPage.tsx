import { useState } from 'react';
import { useSales } from '@/lib/sales-context';
import { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { motion } from 'framer-motion';
import { Plus, Search, Package, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { fmt } from '@/lib/format';
import { toast } from 'sonner';

const UNITS = ['un', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'cx', 'pct', 'par', 'h'];

const emptyForm = (): Omit<Product, 'id'> => ({
  name: '', description: '', price: 0,
  stockQuantity: 0, unit: 'un', active: true,
});

export default function ProductsPage() {
  const { products, loadingProducts, addProduct, updateProduct, deleteProduct } = useSales();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id'>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditTarget(p);
    setForm({ name: p.name, description: p.description || '', price: p.price, stockQuantity: p.stockQuantity, unit: p.unit, active: p.active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (form.price < 0) { toast.error('Preço inválido'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await updateProduct({ ...editTarget, ...form });
      } else {
        await addProduct(form);
      }
      setDialogOpen(false);
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (p: Product) => {
    await updateProduct({ ...p, active: !p.active });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground text-sm">Gerencie seu catálogo de produtos</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Produto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: products.length, sub: 'produtos' },
          { label: 'Ativos', value: products.filter(p => p.active).length, sub: 'disponíveis' },
          { label: 'Inativos', value: products.filter(p => !p.active).length, sub: 'desativados' },
          { label: 'Estoque Baixo', value: products.filter(p => p.stockQuantity <= 5 && p.active).length, sub: '≤ 5 unidades' },
        ].map(s => (
          <div key={s.label} className="finance-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar produto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Product List */}
      {loadingProducts ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">{search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</p>
          {!search && <Button onClick={openAdd} variant="outline" size="sm">Cadastrar primeiro produto</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`finance-card p-4 space-y-3 border-l-4 transition-opacity ${p.active ? 'border-l-primary' : 'border-l-muted opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                </div>
                <Badge variant={p.active ? 'default' : 'secondary'} className="shrink-0 text-xs">
                  {p.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-primary text-lg">{fmt(p.price)}<span className="text-xs text-muted-foreground font-normal">/{p.unit}</span></span>
                <div className="flex items-center gap-1">
                  {p.stockQuantity <= 5 && p.active && <AlertCircle className="h-3 w-3 text-yellow-500" />}
                  <span className="text-muted-foreground text-xs">Estoque: <strong>{p.stockQuantity} {p.unit}</strong></span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Switch checked={p.active} onCheckedChange={() => handleToggleActive(p)} />
                  <span className="text-xs text-muted-foreground">{p.active ? 'Habilitado' : 'Desabilitado'}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do produto" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço (R$) *</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: Math.max(0, parseFloat(e.target.value) || 0) }))}
                />
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Quantidade em Estoque</Label>
              <Input
                type="number" min={0} step={0.001}
                value={form.stockQuantity}
                onChange={e => setForm(f => ({ ...f, stockQuantity: Math.max(0, parseFloat(e.target.value) || 0) }))}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30 border border-border">
              <div>
                <Label className="text-sm font-medium">Produto Ativo</Label>
                <p className="text-xs text-muted-foreground">Disponível para novas vendas</p>
              </div>
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editTarget ? 'Salvar' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={o => { if (!o) setDeleteId(null); }}
        onConfirm={async () => { if (deleteId) { await deleteProduct(deleteId); setDeleteId(null); } }}
        description="Este produto será excluído permanentemente."
      />
    </div>
  );
}
