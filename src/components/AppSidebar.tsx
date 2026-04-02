import { useState } from 'react';
import {
  LayoutDashboard, FileText, FileInput, ArrowUpDown, Wallet, Target, Sun, Moon, BarChart3, LogOut, Tag, RotateCcw,
} from 'lucide-react';
import logoFluxoPro from '@/assets/Logo_FluxoPro.png';
import { NavLink } from '@/components/NavLink';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { useFinance } from '@/lib/finance-context';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const mainItems = [
  { title: 'Painel', url: '/', icon: LayoutDashboard },
  { title: 'Transações', url: '/transactions', icon: ArrowUpDown },
  { title: 'Contas a\u00A0Pagar', url: '/payables', icon: FileText },
  { title: 'Contas a\u00A0Receber', url: '/receivables', icon: FileInput },
];

const manageItems = [
  { title: 'Contas', url: '/accounts', icon: Wallet },
  { title: 'Categorias', url: '/categories', icon: Tag },
  { title: 'Orçamentos', url: '/budgets', icon: Target },
  { title: 'Relatórios', url: '/reports', icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { resetAllData } = useFinance();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <div className="px-4 py-5">
            {!collapsed && (
              <img src={logoFluxoPro} alt="FluxoPro" className="h-48 w-full object-contain" />
            )}
            {collapsed && <img src={logoFluxoPro} alt="FluxoPro" className="h-10 w-10 object-contain mx-auto" />}
          </div>
          <SidebarGroup>
            <SidebarGroupLabel>Visão Geral</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end={item.url === '/'} activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="h-4 w-4 mr-2" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Gerenciar</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {manageItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="h-4 w-4 mr-2" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <button onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-destructive transition-colors w-full">
            <RotateCcw className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Reiniciar Dados</span>}
          </button>
          <button onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {!collapsed && <span className="text-sm">{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>}
          </button>
          <button onClick={signOut}
            className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-destructive transition-colors w-full">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Sair</span>}
          </button>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá apagar permanentemente todas as suas transações, contas a pagar, contas a receber, contas financeiras, orçamentos e categorias. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { await resetAllData(); setConfirmOpen(false); }}
            >
              Sim, reiniciar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
