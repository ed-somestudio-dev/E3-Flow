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
import { Plus, Search, Package, Pencil, Trash2, AlertCircle, Camera, Image as ImageIcon } from 'lucide-react';
import { fmt } from '@/lib/format';
import { toast } from 'sonner';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';

const UNITS = ['un', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'cx', 'pct', 'par', 'h'];

const emptyForm = (): Omit<Product, 'id'> => ({
  name: '', description: '', price: 0,
  stockQuantity: 0, unit: 'un', active: true,
  imageUrl: '',
});

export default function ProductsPage() {
  const { products, loadingProducts, addProduct, updateProduct, deleteProduct } = useSales();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id'>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageToCrop(event.target?.result as string);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setCropDialogOpen(true);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const croppedBase64 = await getCroppedImg(imageToCrop, croppedAreaPixels);
      // Downscale image inside canvas again just to be sure size is small
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, size, size);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setForm(f => ({ ...f, imageUrl: compressedBase64 }));
          setCropDialogOpen(false);
          setImageToCrop(null);
        }
      };
      img.src = croppedBase64;
    } catch (e) {
      toast.error('Erro ao recortar imagem');
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...emptyForm(), priceRaw: '', stockRaw: '' } as any);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditTarget(p);
    setForm({ 
      name: p.name, 
      description: p.description || '', 
      price: p.price, 
      stockQuantity: p.stockQuantity, 
      unit: p.unit, 
      active: p.active,
      imageUrl: p.imageUrl || '',
      priceRaw: p.price.toString(),
      stockRaw: p.stockQuantity.toString()
    } as any);
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
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {p.imageUrl ? (
                    <img 
                      src={p.imageUrl} 
                      alt={p.name} 
                      className="w-16 h-16 object-cover rounded-lg shrink-0 border border-border" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 border border-border">
                      <Package className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                  </div>
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
        <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
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
            <div className="space-y-2">
              <Label>Imagem do Produto</Label>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-lg border border-border bg-secondary/30 flex items-center justify-center overflow-hidden shrink-0">
                  {(form as any).imageUrl ? (
                    <img 
                      src={(form as any).imageUrl} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground/30" />
                  )}
                </div>
                
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="text-xs gap-1.5"
                      onClick={() => document.getElementById('product-image-upload')?.click()}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Upload
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="text-xs gap-1.5"
                      onClick={() => document.getElementById('product-image-camera')?.click()}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Câmera
                    </Button>
                    {(form as any).imageUrl && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs text-destructive hover:text-destructive"
                        onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Ou insira uma URL abaixo:</span>
                </div>
                <input 
                  type="file" 
                  id="product-image-upload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageFileChange} 
                />
                <input 
                  type="file" 
                  id="product-image-camera" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  onChange={handleImageFileChange} 
                />
              </div>
              <Input value={(form as any).imageUrl || ''} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://exemplo.com/imagem.jpg" className="text-xs h-8" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={(form as any).priceRaw ?? (form.price === 0 ? "" : form.price.toString())}
                  onChange={e => {
                    const rawVal = e.target.value;
                    // Permite números, uma vírgula ou um ponto
                    if (rawVal === '' || /^\d*[.,]?\d*$/.test(rawVal)) {
                      const numericVal = parseFloat(rawVal.replace(',', '.')) || 0;
                      setForm(f => ({ 
                        ...f, 
                        price: numericVal,
                        priceRaw: rawVal 
                      } as any));
                    }
                  }}
                  placeholder="0,00"
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
                type="text"
                inputMode="decimal"
                value={(form as any).stockRaw ?? (form.stockQuantity === 0 ? "" : form.stockQuantity.toString())}
                onChange={e => {
                  const rawVal = e.target.value;
                  if (rawVal === '' || /^\d*[.,]?\d*$/.test(rawVal)) {
                    const numericVal = parseFloat(rawVal.replace(',', '.')) || 0;
                    setForm(f => ({ 
                      ...f, 
                      stockQuantity: numericVal,
                      stockRaw: rawVal 
                    } as any));
                  }
                }}
                placeholder="0"
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

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Imagem</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-[300px] bg-black rounded-lg overflow-hidden">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCropDialogOpen(false); setImageToCrop(null); }}>Cancelar</Button>
            <Button onClick={handleApplyCrop}>Aplicar Recorte</Button>
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
