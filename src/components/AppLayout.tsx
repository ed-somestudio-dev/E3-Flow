import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { OfflineBadge, OfflineBanner } from '@/components/OfflineBadge';
import { useSubscription } from '@/lib/subscription-context';
import { AlertTriangle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  // Recarrega a página quando volta de background há mais de 60s
  // (corrige o problema do Chrome mobile que mantém o estado antigo)
  useAutoRefresh({ staleAfterMs: 60_000 });
  const { daysUntilDue, isActive, isAdmin } = useSubscription();
  const location = useLocation();
  const { user } = useAuth();

  const isLifetimeAdmin = user?.email === 'ed-somestudio@live.com' || user?.email === 'contato@e3flow.com.br';
  const showWarning = isActive && daysUntilDue !== null && daysUntilDue <= 5 && location.pathname !== '/subscription' && !isLifetimeAdmin;
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('migrated') === 'true') {
      toast({
        title: "Mudamos de nome!",
        description: "Mas a qualidade e os recursos só aumentaram. Bem-vindo ao E3 Flow!",
        duration: 10000,
      });
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('migrated');
      window.history.replaceState({}, document.title, newUrl.toString());
    }
  }, [toast]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card shrink-0">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin/subscriptions" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Admin Painel
                </Link>
              )}
              <OfflineBadge />
            </div>
          </header>
          <OfflineBanner />
          
          {showWarning && (
            <div className="bg-warning/10 border-b border-warning/20 p-3 flex items-center justify-center gap-2 text-warning text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Sua assinatura expira em {daysUntilDue} dia{daysUntilDue !== 1 && 's'}.</span>
              <Link to="/subscription" className="font-semibold underline ml-2 hover:text-warning/80">
                Renovar agora
              </Link>
            </div>
          )}

          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

