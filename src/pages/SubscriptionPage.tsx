import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, Sparkles } from 'lucide-react';
import { useSubscription, PLANS, TRIAL_DAYS } from '@/lib/subscription-context';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { FamilyShare } from '@/components/FamilyShare';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { createSubscription, updateSubscription, cancelSubscription, loading, subscription, isInTrial, trialDaysRemaining, isTimeTampered } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState(user?.user_metadata?.full_name || '');
  const [customerCpfCnpj, setCustomerCpfCnpj] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  useEffect(() => {
    if (subscription?.subscription_plan) {
      setSelectedPlan(
        Object.entries(PLANS).find(([, p]) => p.name === subscription.subscription_plan || p.planId === subscription.subscription_plan)?.[0] as 'monthly' | 'yearly' || 'monthly'
      );
    }
  }, [subscription?.subscription_plan]);

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

      // Prepara o sistema para mostrar a página de boas-vindas assim que o pagamento confirmar
      localStorage.setItem('pendingWelcome', 'true');

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

  const handleUpdatePlan = async () => {
    setUpdating(true);
    try {
      await updateSubscription(selectedPlan);
      setIsUpdateModalOpen(false);
      toast.success('Plano alterado com sucesso!');
    } catch (err: any) {
      alert("Erro ao alterar plano: " + (err.message || "Erro desconhecido"));
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      await cancelSubscription();
    } catch (err: any) {
      // Error handled in context
    } finally {
      setCanceling(false);
    }
  };

  const isLifetimeAdmin = user?.email?.toLowerCase() === 'ed-somestudio@live.com' || user?.email?.toLowerCase() === 'contato@e3flow.com.br';
  const hasAsaasSubscription = Boolean(subscription?.asaas_subscription_id);
  const isCancelled = subscription?.subscription_status === 'CANCELLED';

  if (isTimeTampered) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center">
        <Badge variant="destructive" className="gap-1.5 text-base py-2 px-4 mb-4">
          Acesso Bloqueado
        </Badge>
        <h1 className="text-3xl font-bold text-destructive">Data do dispositivo incorreta detectada</h1>
        <p className="text-muted-foreground text-lg">
          O relógio do seu dispositivo parece estar atrasado ou foi alterado. Por motivos de segurança, o acesso ao aplicativo foi suspenso preventivamente.
        </p>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mt-6">
          <p className="font-medium text-foreground">Como resolver:</p>
          <ol className="text-left text-sm text-muted-foreground mt-4 space-y-2 list-decimal list-inside">
            <li>Acesse as configurações do seu dispositivo.</li>
            <li>Ajuste a Data e Hora para <strong>Automático (fornecido pela rede)</strong>.</li>
            <li>Conecte-se à internet.</li>
            <li>Feche o aplicativo e abra novamente.</li>
          </ol>
        </div>
      </div>
    );
  }

  if (isLifetimeAdmin || (subscription && !isCancelled && (subscription.subscription_status === 'RECEIVED' || subscription.subscription_status === 'CONFIRMED' || (isInTrial && hasAsaasSubscription)))) {
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
              Assinatura {isLifetimeAdmin ? 'Vitalícia (E3 Flow)' : (PLANS[subscription?.subscription_plan as keyof typeof PLANS]?.name || subscription?.subscription_plan || 'E3 Flow')}
            </CardTitle>
            <CardDescription className="font-bold text-primary">
              Status: {
                isLifetimeAdmin ? 'ADMINISTRADOR VITALÍCIO' :
                subscription?.subscription_status === 'RECEIVED' || subscription?.subscription_status === 'CONFIRMED' ? 'ATIVA' :
                subscription?.subscription_status === 'TRIAL' ? 'EM TESTE' :
                subscription?.subscription_status || 'DESCONHECIDO'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInTrial && trialDaysRemaining !== null && !isLifetimeAdmin && (
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
            {(isLifetimeAdmin || subscription?.subscription_due_date) && (
              <div>
                <p className="text-sm text-muted-foreground">Próximo vencimento</p>
                <p className="font-medium">{isLifetimeAdmin ? 'INDETERMINADO' : new Date(subscription!.subscription_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="font-medium">{isLifetimeAdmin ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Object.values(PLANS).find(p => p.name === subscription?.subscription_plan || p.planId === subscription?.subscription_plan)?.value || 0)}</p>
            </div>
          </CardContent>
            {!isLifetimeAdmin && (
              <CardFooter className="border-t pt-6 mt-2 flex flex-col sm:flex-row gap-3">
                 <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
                   <DialogTrigger asChild>
                     <Button variant="outline" className="w-full sm:w-auto">Alterar Plano</Button>
                   </DialogTrigger>
                   <DialogContent className="max-w-2xl">
                     <DialogHeader>
                       <DialogTitle>Alterar Plano</DialogTitle>
                       <DialogDescription>
                         Escolha o novo plano. A mudança será aplicada na sua assinatura.
                       </DialogDescription>
                     </DialogHeader>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {Object.entries(PLANS).map(([key, plan]) => {
                        const isYearly = key === 'yearly';
                        const isSelected = selectedPlan === key;
                        return (
                          <Card
                            key={key}
                            className={`cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'}`}
                            onClick={() => setSelectedPlan(key as 'monthly' | 'yearly')}
                          >
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <Crown className="h-4 w-4" />
                                  {plan.name}
                                </CardTitle>
                              </div>
                              <CardDescription className="text-xl font-bold">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.value)}
                                <span className="text-sm font-normal text-muted-foreground">
                                  {isYearly ? '/ano' : '/mês'}
                                </span>
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        );
                      })}
                     </div>

                     <div className="flex justify-end mt-4">
                       <Button onClick={handleUpdatePlan} disabled={updating}>
                         {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                         Confirmar Alteração
                       </Button>
                     </div>
                   </DialogContent>
                 </Dialog>

                 <AlertDialog>
                   <AlertDialogTrigger asChild>
                     <Button variant="destructive" className="w-full sm:w-auto" disabled={canceling}>
                       {canceling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                       Cancelar Assinatura
                     </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                       <AlertDialogDescription>
                         Isso cancelará sua assinatura imediatamente e as cobranças futuras serão suspensas. Você perderá acesso aos recursos premium após o período vigente.
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>Voltar</AlertDialogCancel>
                       <AlertDialogAction onClick={handleCancelSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                         Sim, cancelar
                       </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
              </CardFooter>
            )}
        </Card>

        <FamilyShare />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isInTrial && trialDaysRemaining !== null && (!hasAsaasSubscription || isCancelled) && (
        <div className="max-w-md mx-auto rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-left">
            <p className="font-medium text-primary text-sm">Você está no período de teste gratuito</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Restam <strong>{trialDaysRemaining}</strong> {trialDaysRemaining === 1 ? 'dia' : 'dias'} de trial. Escolha um plano para ativar sua assinatura (só será cobrado após o teste).
            </p>
          </div>
        </div>
      )}

      <div className="text-center space-y-3">
        {isInTrial ? (
          <>
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {trialDaysRemaining} dias restantes de teste
            </Badge>
            <h1 className="text-3xl font-bold">Escolha seu plano</h1>
            <p className="text-muted-foreground">Você ainda tem {trialDaysRemaining} dias de teste grátis. Escolha o melhor plano para você e só pague depois.</p>
          </>
        ) : (
          <>
            <Badge variant="destructive" className="gap-1.5">
              Tempo Esgotado
            </Badge>
            <h1 className="text-3xl font-bold">
              {isCancelled ? 'Reative sua assinatura' : 'Assine o E3 Flow'}
            </h1>
            <p className="text-muted-foreground">
              {isCancelled 
                ? 'Sua assinatura foi cancelada, mas você ainda pode escolher um plano para continuar usando o sistema.' 
                : 'Seu período de teste grátis chegou ao fim. Escolha o melhor plano para continuar usando o sistema.'}
            </p>
          </>
        )}
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
            isInTrial ? `Começar assinatura (Restam ${trialDaysRemaining} dias grátis)` : 'Assinar Plano'
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Você será redirecionado para o ambiente seguro do Asaas para escolher Pix, Cartão ou Boleto.
          {isInTrial ? ' A primeira cobrança só ocorrerá após o período de teste.' : ''}
        </p>
      </div>
    </div>
  );
}
