import { useState, useEffect } from 'react';
import { useFinance } from '@/lib/finance-context';
import { Payable, Receivable } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftRight, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { fmt } from '@/lib/format';
import { toast } from 'sonner';

interface DebtOffsetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  payables: Payable[];
  receivables: Receivable[];
}

export function DebtOffsetModal({
  open,
  onOpenChange,
  contactName,
  payables = [],
  receivables = [],
}: DebtOffsetModalProps) {
  const { data, markPayablePaid, markPayablePaidPartial, markReceivableReceived, markReceivableReceivedPartial } = useFinance();
  const [accountId, setAccountId] = useState<string>('');
  const [offsetAmount, setOffsetAmount] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const pendingPayables = (payables || []).filter(p => p && p.status !== 'paid');
  const pendingReceivables = (receivables || []).filter(r => r && r.status !== 'received');

  const payablesTotal = pendingPayables.reduce((s, p) => s + (p?.amount || 0), 0);
  const receivablesTotal = pendingReceivables.reduce((s, r) => s + (r?.amount || 0), 0);
  const maxOffset = Math.min(payablesTotal, receivablesTotal);

  useEffect(() => {
    if (open) {
      setOffsetAmount(maxOffset > 0 ? maxOffset.toFixed(2) : '');
      const accountsList = data?.accounts || [];
      if (accountsList.length > 0 && !accountId) {
        setAccountId(accountsList[0].id);
      }
    }
  }, [open, maxOffset, data?.accounts, accountId]);

  const handleConfirmOffset = async () => {
    const amt = parseFloat(offsetAmount);
    if (!amt || amt <= 0) {
      toast.error('Informe um valor de compensação válido');
      return;
    }
    if (amt > maxOffset + 0.01) {
      toast.error(`O valor máximo para compensação direta é ${fmt(maxOffset)}`);
      return;
    }
    if (!accountId) {
      toast.error('Selecione uma conta para registrar as transações');
      return;
    }

    setSaving(true);
    try {
      // 1) Processar contas a receber (FIFO - mais antigas primeiro)
      let remRec = amt;
      const sortedRec = [...pendingReceivables].sort((a, b) => (a?.dueDate || '').localeCompare(b?.dueDate || ''));
      for (const r of sortedRec) {
        if (remRec <= 0) break;
        if (remRec >= r.amount - 0.005) {
          await markReceivableReceived(r.id, accountId);
          remRec = Math.round((remRec - r.amount) * 100) / 100;
        } else {
          await markReceivableReceivedPartial(r.id, accountId, remRec);
          remRec = 0;
        }
      }

      // 2) Processar contas a pagar (FIFO - mais antigas primeiro)
      let remPay = amt;
      const sortedPay = [...pendingPayables].sort((a, b) => (a?.dueDate || '').localeCompare(b?.dueDate || ''));
      for (const p of sortedPay) {
        if (remPay <= 0) break;
        const isInvoice = (p?.supplier || '').startsWith('cartao:');
        if (remPay >= p.amount - 0.005) {
          await markPayablePaid(p.id, accountId, isInvoice);
          remPay = Math.round((remPay - p.amount) * 100) / 100;
        } else {
          await markPayablePaidPartial(p.id, accountId, remPay, isInvoice);
          remPay = 0;
        }
      }

      toast.success(`Encontro de contas de ${fmt(amt)} realizado com sucesso! Registradas transações de receita e despesa.`);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao realizar encontro de contas');
    } finally {
      setSaving(false);
    }
  };

  const currentNet = receivablesTotal - payablesTotal;
  const numAmt = parseFloat(offsetAmount) || 0;
  const newReceivablesTotal = Math.max(0, receivablesTotal - numAmt);
  const newPayablesTotal = Math.max(0, payablesTotal - numAmt);
  const newNet = newReceivablesTotal - newPayablesTotal;
  const accountsList = data?.accounts || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Encontro de Contas (Compensação)
          </DialogTitle>
          <DialogDescription>
            Abata contas a pagar e a receber de <strong>{contactName || 'contato'}</strong> simultaneamente gerando lançamentos de receita e despesa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card de Resumo do Contato */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            <div>
              <span className="text-xs text-muted-foreground block flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" /> Total a Pagar
              </span>
              <span className="font-bold text-destructive mono text-base">{fmt(payablesTotal)}</span>
              <span className="text-[11px] text-muted-foreground block">{pendingPayables.length} {pendingPayables.length === 1 ? 'conta' : 'contas'}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-success" /> Total a Receber
              </span>
              <span className="font-bold text-success mono text-base">{fmt(receivablesTotal)}</span>
              <span className="text-[11px] text-muted-foreground block">{pendingReceivables.length} {pendingReceivables.length === 1 ? 'conta' : 'contas'}</span>
            </div>
          </div>

          {/* Saldo Líquido */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Saldo Líquido Atual</span>
            <span className={`font-bold mono text-sm ${currentNet > 0 ? 'text-success' : currentNet < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {currentNet > 0 ? `A receber ${fmt(currentNet)}` : currentNet < 0 ? `A pagar ${fmt(Math.abs(currentNet))}` : 'Quitado (R$ 0,00)'}
            </span>
          </div>

          {/* Valor a Compensar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Valor da Compensação (R$)</Label>
              <span className="text-xs text-muted-foreground">Máximo possível: <strong>{fmt(maxOffset)}</strong></span>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={maxOffset}
              value={offsetAmount}
              onChange={(e) => setOffsetAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>

          {/* Conta Financeira para Lançamento */}
          <div className="space-y-2">
            <Label>Conta para Lançamento das Transações</Label>
            <Select value={accountId || undefined} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
              <SelectContent>
                {accountsList.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{a.name}</span>
                      <span className="text-xs text-muted-foreground mono">{fmt(a.balance)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Será gerada uma entrada de Receita de {fmt(numAmt)} e uma saída de Despesa de {fmt(numAmt)}, resultando em impacto líquido nulo no saldo financeiro da conta.
            </p>
          </div>

          {/* Previsão após compensação */}
          {numAmt > 0 && numAmt <= maxOffset && (
            <div className="p-3 rounded-lg bg-secondary/40 border border-border text-xs space-y-1">
              <span className="font-semibold block text-foreground">Após este Encontro de Contas:</span>
              <div className="flex justify-between text-muted-foreground">
                <span>Novo Total a Pagar:</span>
                <span className="mono font-semibold text-foreground">{fmt(newPayablesTotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Novo Total a Receber:</span>
                <span className="mono font-semibold text-foreground">{fmt(newReceivablesTotal)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border font-medium">
                <span>Novo Saldo Líquido:</span>
                <span className={`mono font-bold ${newNet > 0 ? 'text-success' : newNet < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {newNet > 0 ? `A receber ${fmt(newNet)}` : newNet < 0 ? `A pagar ${fmt(Math.abs(newNet))}` : 'Quitado (R$ 0,00)'}
                </span>
              </div>
            </div>
          )}

          <Button
            className="w-full h-11 text-base font-semibold gap-2"
            onClick={handleConfirmOffset}
            disabled={saving || !numAmt || numAmt <= 0 || numAmt > maxOffset + 0.01 || !accountId}
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving ? 'Processando...' : `Confirmar Compensação de ${fmt(numAmt)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
