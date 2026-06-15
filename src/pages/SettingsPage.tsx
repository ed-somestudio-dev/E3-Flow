import { useState, useEffect, useRef } from 'react';
import { usePixSettings, PixSettingsRow } from '@/lib/pix-settings-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QrCode, Save, Stamp, Upload, Trash2, Bell, ShoppingCart, Crown, MessageCircle, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useSubscription } from '@/lib/subscription-context';
import { Link } from 'react-router-dom';

export default function SettingsPage() {
  const { settings, save, loaded, uploadStamp, removeStamp } = usePixSettings();
  const { subscription, isInTrial, trialDaysRemaining } = useSubscription();
  const [form, setForm] = useState<PixSettingsRow>(settings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setForm(settings); }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try { 
      await save(form); 
      toast.success('Configurações PIX salvas');
    } catch {
      toast.error('Erro ao salvar');
    } finally { 
      setSaving(false); 
    }
  };

  const handleSaveField = async (field: keyof PixSettingsRow, value: any) => {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    try { 
      await save(newForm); 
    } catch {
      toast.error('Erro ao salvar configuração');
    }
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
            onCheckedChange={(v) => handleSaveField('remindersEnabled', v)}
          />
        </div>

        <div>
          <Label>Antecedência (dias antes do vencimento)</Label>
          <Input
            type="number" min={0} max={30}
            value={form.reminderDaysBefore}
            onChange={e => setForm({ ...form, reminderDaysBefore: Math.max(0, Math.min(30, parseInt(e.target.value) || 0)) })}
            onBlur={() => handleSaveField('reminderDaysBefore', form.reminderDaysBefore)}
            disabled={!form.remindersEnabled}
            placeholder="3"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Contas que vencem nos próximos {form.reminderDaysBefore} dia{form.reminderDaysBefore !== 1 ? 's' : ''} aparecerão como aviso. Vencidas sempre aparecem.
          </p>
        </div>
      </div>

      {/* Mensagens Automáticas de WhatsApp */}
      <div className="finance-card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <MessageCircle className="h-5 w-5 text-green-500" />
          <h2 className="font-semibold">Mensagens de WhatsApp</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Configure os textos automáticos usados ao enviar cobranças pelo WhatsApp.
          <br/>Você pode usar as variáveis <strong className="text-primary">{'{nome}'}</strong>, <strong className="text-primary">{'{valor}'}</strong> e <strong className="text-primary">{'{vencimento}'}</strong> para personalizar a mensagem.
        </p>

        <div className="space-y-4 mt-4">
          <div className="p-4 rounded-md border border-border bg-secondary/20 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Bell className="h-4 w-4" /> Lembrete de Vencimento</h3>
            <div>
              <Label>Avisar quantos dias antes?</Label>
              <Input
                type="number" min={0} max={30}
                value={form.whatsappReminderDays}
                onChange={e => setForm({ ...form, whatsappReminderDays: Math.max(0, parseInt(e.target.value) || 0) })}
                onBlur={() => handleSaveField('whatsappReminderDays', form.whatsappReminderDays)}
                placeholder="3"
                className="max-w-[120px]"
              />
            </div>
            <div>
              <Label>Texto da Mensagem</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={form.whatsappReminderMsg}
                onChange={e => setForm({ ...form, whatsappReminderMsg: e.target.value })}
                onBlur={() => handleSaveField('whatsappReminderMsg', form.whatsappReminderMsg)}
                placeholder="Olá {nome}, sua conta de {valor} vence..."
              />
            </div>
          </div>

          <div className="p-4 rounded-md border border-border bg-destructive/5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Cobrança de Atraso</h3>
            <div>
              <Label>Cobrar quantos dias depois?</Label>
              <Input
                type="number" min={0} max={30}
                value={form.whatsappOverdueDays}
                onChange={e => setForm({ ...form, whatsappOverdueDays: Math.max(0, parseInt(e.target.value) || 0) })}
                onBlur={() => handleSaveField('whatsappOverdueDays', form.whatsappOverdueDays)}
                placeholder="1"
                className="max-w-[120px]"
              />
            </div>
            <div>
              <Label>Texto da Mensagem</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={form.whatsappOverdueMsg}
                onChange={e => setForm({ ...form, whatsappOverdueMsg: e.target.value })}
                onBlur={() => handleSaveField('whatsappOverdueMsg', form.whatsappOverdueMsg)}
                placeholder="Olá {nome}, sua conta venceu..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Módulo de Vendas */}
      <div className="finance-card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Módulo de Vendas</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Habilite o módulo de vendas para cadastrar produtos, controlar estoque e registrar vendas.
          Quando ativo, os menus <strong>Vendas</strong> e <strong>Produtos</strong> aparecerão na navegação.
        </p>

        <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-secondary/30 border border-border">
          <div>
            <Label className="text-sm font-medium">Ativar módulo de vendas</Label>
            <p className="text-xs text-muted-foreground">Produtos, estoque e registro de vendas</p>
          </div>
          <Switch
            checked={form.salesModuleEnabled}
            onCheckedChange={(v) => handleSaveField('salesModuleEnabled', v)}
          />
        </div>

        {form.salesModuleEnabled && (
          <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
            ✅ Módulo ativo — acesse <strong>Vendas</strong> e <strong>Produtos</strong> no menu lateral.
            As vendas concluídas atualizam automaticamente o estoque dos produtos.
          </div>
        )}

        {/* Botão de salvar removido - salvamento automático */}
      </div>

      {/* Assinatura */}
      <div className="finance-card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Crown className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Assinatura e Plano</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Gerencie seu plano de assinatura, visualize o status e o histórico de faturamento no Asaas.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-md bg-secondary/30 border border-border">
          <div>
            <p className="text-sm font-medium">
              Status Atual: <span className="font-bold text-primary">{subscription?.subscription_status || (isInTrial ? 'TESTE GRATUITO (Trial)' : 'INATIVO')}</span>
            </p>
            {isInTrial && trialDaysRemaining !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                Restam <strong>{trialDaysRemaining}</strong> {trialDaysRemaining === 1 ? 'dia' : 'dias'} de teste gratuito.
              </p>
            )}
            {subscription?.subscription_due_date && (
              <p className="text-xs text-muted-foreground mt-1">
                Vencimento: <strong>{new Date(subscription.subscription_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
              </p>
            )}
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/subscription">
              Gerenciar Assinatura
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
