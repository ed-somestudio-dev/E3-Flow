import { useState, useEffect } from 'react';
import { usePixSettings, PixSettingsRow } from '@/lib/pix-settings-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QrCode, Save } from 'lucide-react';

export default function SettingsPage() {
  const { settings, save, loaded } = usePixSettings();
  const [form, setForm] = useState<PixSettingsRow>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try { await save(form); } finally { setSaving(false); }
  };

  if (!loaded) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Configure seus dados PIX para gerar cobranças e recibos</p>
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
    </div>
  );
}
