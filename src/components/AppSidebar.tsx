import {
  LayoutDashboard, FileText, FileInput, ArrowUpDown, Wallet, PiggyBank, Target, Sun, Moon, BarChart3, LogOut,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

const mainItems = [
  { title: 'Painel', url: '/', icon: LayoutDashboard },
  { title: 'Transações', url: '/transactions', icon: ArrowUpDown },
  { title: 'Contas a Pagar', url: '/payables', icon: FileText },
  { title: 'Contas a\u00A0Receber', url: '/receivables', icon: FileInput },
];

const manageItems = [
  { title: 'Contas', url: '/accounts', icon: Wallet },
  { title: 'Orçamentos', url: '/budgets', icon: Target },
  { title: 'Relatórios', url: '/reports', icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-5">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <PiggyBank className="h-7 w-7 text-sidebar-primary" />
              <span className="text-lg font-bold text-sidebar-foreground">FinanceFlow</span>
            </div>
          )}
          {collapsed && <PiggyBank className="h-7 w-7 text-sidebar-primary mx-auto" />}
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
        <button onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full">
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {!collapsed && <span className="text-sm">{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
