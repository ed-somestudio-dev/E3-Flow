import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { OfflineBadge, OfflineBanner } from '@/components/OfflineBadge';


export function AppLayout({ children }: { children: React.ReactNode }) {
  // Recarrega a página quando volta de background há mais de 60s
  // (corrige o problema do Chrome mobile que mantém o estado antigo)
  useAutoRefresh({ staleAfterMs: 60_000 });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card shrink-0">
            <SidebarTrigger className="mr-4" />
            <OfflineBadge />
          </header>
          <OfflineBanner />
          <BillsReminderBanner />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

