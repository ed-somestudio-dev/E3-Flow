import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription, PLANS } from '@/lib/subscription-context';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/asaas';

interface SubInfo {
  id: string;
  user_email: string;
  user_name: string;
  status: string;
  plan: string;
  due_date: string;
}

export default function AdminSubscriptionsPage() {
  const { isAdmin, loading } = useSubscription();
  const [data, setData] = useState<SubInfo[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadData() {
      try {
        // Usa a nova RPC segura que já faz o join com auth.users no backend
        // @ts-expect-error - get_admin_subscriptions is a custom RPC not yet in types
        const { data: subs, error } = await supabase.rpc('get_admin_subscriptions');

        if (error) {
          console.error(error);
          return;
        }

        // Mapeia os dados da RPC
        const mapped = (subs || []).map((s: any) => ({
          id: s.id,
          user_email: s.user_email || 'Email não encontrado',
          user_name: s.user_name || 'Usuário',
          status: s.subscription_status,
          plan: s.subscription_plan,
          due_date: s.subscription_due_date,
        }));
        
        setData(mapped);
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, [isAdmin]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const activeCount = data.filter(d => d.status === 'RECEIVED' || d.status === 'CONFIRMED' || d.status === 'TRIAL').length;
  const overdueCount = data.filter(d => d.status === 'OVERDUE').length;
  // MRR estimado com base no plano real de cada assinante ativo
  const mrr = data
    .filter(d => d.status === 'RECEIVED' || d.status === 'CONFIRMED')
    .reduce((sum, d) => {
      const planValue = (d.plan || '').toLowerCase();
      // Encontra o plano pelo planId ('monthly', 'yearly') ou pelo nome ('mensal', 'anual')
      const plan = Object.values(PLANS).find(
        p => p.planId.toLowerCase() === planValue || p.name.toLowerCase() === planValue
      );
      if (!plan) return sum;
      
      const monthly = plan.cycle === 'YEARLY' ? plan.value / 12 : plan.value;
      return sum + monthly;
    }, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
      case 'CONFIRMED':
        return 'text-success bg-success/10 border-success/20';
      case 'TRIAL':
        return 'text-primary bg-primary/10 border-primary/20';
      case 'OVERDUE':
        return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'PENDING':
        return 'text-warning bg-warning/10 border-warning/20';
      default:
        return 'text-muted-foreground bg-muted border-muted';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <h1 className="text-3xl font-bold">Painel Administrativo</h1>
      <p className="text-muted-foreground">Gerenciamento de Assinaturas</p>

      {fetching ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Assinantes Ativos</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vencidas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overdueCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Cadastros</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">MRR Estimado</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{formatCurrency(mrr)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Listagem de Assinaturas</CardTitle>
            </CardHeader>
            <CardContent>
              {data.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma assinatura encontrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Usuário</th>
                        <th className="px-4 py-3 font-medium">Plano</th>
                        <th className="px-4 py-3 font-medium">Próx. Vencimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((item) => (
                        <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-[10px] uppercase font-bold rounded border ${getStatusColor(item.status)}`}>
                              {{
                                RECEIVED: 'Recebida',
                                CONFIRMED: 'Confirmada',
                                OVERDUE: 'Vencida',
                                TRIAL: 'Teste (Trial)',
                                PENDING: 'Pendente',
                                CANCELLED: 'Cancelada',
                                INACTIVE: 'Inativa'
                              }[item.status] || item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.user_name}</div>
                            <div className="text-xs text-muted-foreground">{item.user_email}</div>
                          </td>
                          <td className="px-4 py-3 font-medium">{PLANS[item.plan as keyof typeof PLANS]?.name || item.plan}</td>
                          <td className="px-4 py-3">
                            {item.due_date ? new Date(item.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
