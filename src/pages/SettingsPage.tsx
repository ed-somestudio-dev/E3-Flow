import { useState, useEffect, useRef } from 'react';
import { usePixSettings, PixSettingsRow } from '@/lib/pix-settings-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QrCode, Save, Stamp, Upload, Trash2, Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { settings, save, loaded, uploadStamp, removeStamp } = usePixSettings();
  const [form, setForm] = useState<PixSettingsRow>(settings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setForm(settings); }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try { await save(form); } finally { setSaving(false); }
  };

  const handleStampPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (PNG/JPG)');
      return;
    }
    setUploading(true);
    try {
      await uploadStamp(file);
      toast.success('Carimbo enviado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveStamp = async () => {
    setUploading(true);
    try { await removeStamp(); toast.success('Carimbo removido'); }
    finally { setUploading(false); }
  };

  if (!loaded) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Configure seus dados PIX e personalize seus recibos</p>
      </div>

      <div className="finance-card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <QrCode className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Dados PIX para Cobrança</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <Label>Tipo de Chave</Label>
            <Select value={form.pixKeyType} onValueChange={v => setForm({ ...form, pixKeyType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Chave Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Chave PIX</Label>
            <Input value={form.pixKey} onChange={e => setForm({ ...form, pixKey: e.target.value })}
              placeholder="Sua chave PIX" />
          </div>
        </div>

        <div>
          <Label>Nome do Beneficiário</Label>
          <Input value={form.beneficiaryName} onChange={e => setForm({ ...form, beneficiaryName: e.target.value })}
            placeholder="Nome que aparecerá no QR Code (máx 25 caracteres)" maxLength={25} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Cidade</Label>
            <Input value={form.beneficiaryCity} onChange={e => setForm({ ...form, beneficiaryCity: e.target.value })}
              placeholder="Cidade (máx 15 caracteres)" maxLength={15} />
          </div>
          <div>
            <Label>CPF/CNPJ (opcional)</Label>
            <Input value={form.beneficiaryDocument} onChange={e => setForm({ ...form, beneficiaryDocument: e.target.value })}
              placeholder="Aparece no recibo" />
          </div>
        </div>

        <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
          Esses dados serão usados para gerar QR Codes PIX nas cobranças e identificar o beneficiário nos recibos.
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>

      <div className="finance-card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Stamp className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Carimbo / Assinatura para Recibo</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Envie uma imagem PNG ou JPG do seu carimbo "PAGO" ou da sua assinatura.
          Ela será incluída automaticamente nos recibos em PDF. Recomendado: PNG com fundo transparente, máx 2MB.
        </p>

        {settings.receiptStampUrl ? (
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="rounded-md border border-border bg-secondary/30 p-3 flex items-center justify-center w-full sm:w-48 h-32">
              <img
                src={settings.receiptStampUrl}
                alt="Carimbo / Assinatura"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-2" /> Substituir
              </Button>
              <Button variant="outline" onClick={handleRemoveStamp} disabled={uploading}
                className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Enviando...' : 'Enviar imagem do carimbo'}
          </Button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleStampPick}
        />
      </div>

      <div className="finance-card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Lembretes de Contas</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Mostra um aviso no topo do app quando houver contas a pagar ou receber vencidas
          ou próximas do vencimento.
        </p>

        <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-secondary/30 border border-border">
          <div>
            <Label className="text-sm font-medium">Ativar lembretes</Label>
            <p className="text-xs text-muted-foreground">Banner no topo do app</p>
          </div>
          <Switch
            checked={form.remindersEnabled}
            onCheckedChange={(v) => setForm({ ...form, remindersEnabled: v })}
          />
        </div>

        <div>
          <Label>Antecedência (dias antes do vencimento)</Label>
          <Input
            type="number" min={0} max={30}
            value={form.reminderDaysBefore}
            onChange={e => setForm({ ...form, reminderDaysBefore: Math.max(0, Math.min(30, parseInt(e.target.value) || 0)) })}
            disabled={!form.remindersEnabled}
            placeholder="3"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Contas que vencem nos próximos {form.reminderDaysBefore} dia{form.reminderDaysBefore !== 1 ? 's' : ''} aparecerão como aviso. Vencidas sempre aparecem.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar lembretes'}
        </Button>
      </div>
    </div>
  );
}
