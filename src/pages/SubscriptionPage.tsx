import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, Sparkles } from 'lucide-react';
import { useSubscription, PLANS, TRIAL_DAYS } from '@/lib/subscription-context';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { createSubscription, loading, subscription, isInTrial, trialDaysRemaining } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [creating, setCreating] = useState(false);
  const [customerName, setCustomerName] = useState(user?.user_metadata?.full_name || '');
  const [customerCpfCnpj, setCustomerCpfCnpj] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const handleSubscribe = async () => {
    if (!customerName || !customerCpfCnpj) {
      toast.error('Preencha nome e CPF/CNPJ');
      return;
    }

    setCreating(true);
    try {
      const result = await createSubscription(selectedPlan, {
        name: customerName,
        cpfCnpj: customerCpfCnpj.replace(/\D/g, ''),
        phone: customerPhone,
      });

      if (result.invoiceUrl) {
        window.location.href = result.invoiceUrl; // Redireciona para o checkout do Asaas
      } else {
        toast.info('Assinatura criada. Verifique seu email para o link de pagamento.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar assinatura');
    } finally {
      setCreating(false);
    }
  };

  if (subscription && (subscription.subscription_status === 'RECEIVED' || subscription.subscription_status === 'CONFIRMED' || subscription.subscription_status === 'TRIAL' || isInTrial)) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Minha Assinatura</h1>
          <p className="text-muted-foreground">Detalhes da sua assinatura ativa</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Assinatura {PLANS[subscription.subscription_plan as keyof typeof PLANS]?.name || 'FluxoPro'}
            </CardTitle>
            <CardDescription>Status: {subscription.subscription_status}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInTrial && trialDaysRemaining !== null && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-primary">Você está no período de teste gratuito</p>
                  <p className="text-sm text-muted-foreground">
                    Restam <strong>{trialDaysRemaining}</strong> {trialDaysRemaining === 1 ? 'dia' : 'dias'} de trial. Aproveite todos os recursos sem custo.
                  </p>
                </div>
              </div>
            )}
            {subscription.subscription_due_date && (
              <div>
                <p className="text-sm text-muted-foreground">Próximo vencimento</p>
                <p className="font-medium">{new Date(subscription.subscription_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(PLANS[subscription.subscription_plan as keyof typeof PLANS]?.value || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isInTrial && trialDaysRemaining !== null && !subscription && (
        <div className="max-w-md mx-auto rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-left">
            <p className="font-medium text-primary text-sm">Você está no período de teste gratuito</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Restam <strong>{trialDaysRemaining}</strong> {trialDaysRemaining === 1 ? 'dia' : 'dias'} de trial. Aproveite todos os recursos sem custo.
            </p>
          </div>
        </div>
      )}

      <div className="text-center space-y-3">
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {TRIAL_DAYS} dias de teste grátis
        </Badge>
        <h1 className="text-3xl font-bold">Escolha seu plano</h1>
        <p className="text-muted-foreground">Teste grátis por {TRIAL_DAYS} dias. Cancele quando quiser, sem multa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {Object.entries(PLANS).map(([key, plan]) => {
          const isYearly = key === 'yearly';
          const isSelected = selectedPlan === key;
          const monthlyEquivalent = isYearly ? plan.value / 12 : plan.value;
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'}`}
              onClick={() => setSelectedPlan(key as 'monthly' | 'yearly')}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5" />
                    {plan.name}
                  </CardTitle>
                  {isYearly && (
                    <Badge className="bg-success/15 text-success border-success/30">
                      Economize ~37%
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.value)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {isYearly ? '/ano' : '/mês'}
                  </span>
                </CardDescription>
                {isYearly && (
                  <p className="text-xs text-muted-foreground">
                    Equivalente a {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyEquivalent)}/mês
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>{TRIAL_DAYS} dias de teste grátis</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>Acesso completo ao sistema</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>Cobranças PIX ilimitadas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span>Suporte prioritário</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="finance-card max-w-md mx-auto p-6 space-y-4">
        <h3 className="font-semibold mb-4">Dados para fatura</h3>
        
        <div>
          <Label>Nome completo</Label>
          <Input 
            value={customerName} 
            onChange={e => setCustomerName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        <div>
          <Label>CPF/CNPJ</Label>
          <Input 
            value={customerCpfCnpj} 
            onChange={e => setCustomerCpfCnpj(e.target.value)}
            placeholder="Apenas números"
          />
        </div>

        <div>
          <Label>Telefone (opcional)</Label>
          <Input 
            value={customerPhone} 
            onChange={e => setCustomerPhone(e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </div>

        <Button
          onClick={handleSubscribe}
          disabled={creating || !customerName || !customerCpfCnpj}
          className="w-full"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            `Começar ${TRIAL_DAYS} dias de teste grátis`
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Você será redirecionado para o ambiente seguro do Asaas para escolher Pix, Cartão ou Boleto.
          A cobrança só acontece após o período de teste.
        </p>
      </div>
    </div>
  );
}
