import { useState, useRef } from 'react';
import {
  LayoutDashboard, FileText, FileInput, ArrowUpDown, Wallet, Target, Sun, Moon, BarChart3, LogOut, Tag, RotateCcw, Download, Upload, Settings,
} from 'lucide-react';
import logoFluxoPro from '@/assets/Logo_FluxoPro.png';
import { NavLink } from '@/components/NavLink';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { useFinance } from '@/lib/finance-context';
import { SAFE_LABELS } from '@/lib/safe-labels';
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
  { title: SAFE_LABELS.payables, url: '/payables', icon: FileText },
  { title: SAFE_LABELS.receivables, url: '/receivables', icon: FileInput },
];

const manageItems = [
  { title: 'Contas', url: '/accounts', icon: Wallet },
  { title: 'Categorias', url: '/categories', icon: Tag },
  { title: 'Orçamentos', url: '/budgets', icon: Target },
  { title: 'Relatórios', url: '/reports', icon: BarChart3 },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { resetAllData, exportBackup, importBackup } = useFinance();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

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
          <button onClick={exportBackup}
            className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full">
            <Download className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Exportar Backup</span>}
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full">
            <Upload className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Restaurar Backup</span>}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) { pendingFileRef.current = file; setRestoreConfirmOpen(true); }
            e.target.value = '';
          }} />
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
              Esta ação irá apagar permanentemente todas as suas transações, {SAFE_LABELS.lowerPayables}, {SAFE_LABELS.lowerReceivables}, contas financeiras, orçamentos e categorias. Esta ação não pode ser desfeita.
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

      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá substituir todos os seus dados atuais pelos dados do backup. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { pendingFileRef.current = null; }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={async () => {
                if (pendingFileRef.current) {
                  await importBackup(pendingFileRef.current);
                  pendingFileRef.current = null;
                }
                setRestoreConfirmOpen(false);
              }}
            >
              Sim, restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
