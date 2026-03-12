import {
  LayoutDashboard, FileText, FileInput, ArrowUpDown, Wallet, PiggyBank, Target, Sun, Moon,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useTheme } from '@/lib/theme-context';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

const mainItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Transactions', url: '/transactions', icon: ArrowUpDown },
  { title: 'Accounts Payable', url: '/payables', icon: FileText },
  { title: 'Accounts Receivable', url: '/receivables', icon: FileInput },
];

const manageItems = [
  { title: 'Accounts', url: '/accounts', icon: Wallet },
  { title: 'Budgets', url: '/budgets', icon: Target },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, toggleTheme } = useTheme();

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
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
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
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
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
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {!collapsed && <span className="text-sm">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
