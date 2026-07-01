import { useState, useRef } from 'react';
import {
  LayoutDashboard, FileText, FileInput, ArrowUpDown, Wallet, Target, Sun, Moon,
  BarChart3, LogOut, Tag, RotateCcw, Download, Upload, Settings, Users,
  ChevronDown, MoreHorizontal, Smartphone, ShoppingCart, Package, Crown, HelpCircle, Loader2
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import logoE3Flow from '@/assets/Logo_E3Flow.png';
import { NavLink } from '@/components/NavLink';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { useFinance } from '@/lib/finance-context';
import { usePixSettings } from '@/lib/pix-settings-context';
import { SAFE_LABELS } from '@/lib/safe-labels';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const mainItems = [
  { title: 'Painel', url: '/', icon: LayoutDashboard },
  { title: 'Transações', url: '/transactions', icon: ArrowUpDown },
  { title: SAFE_LABELS.payables, url: '/payables', icon: FileText },
  { title: SAFE_LABELS.receivables, url: '/receivables', icon: FileInput },
];

const manageItems = [
  { title: 'Contas', url: '/accounts', icon: Wallet },
  { title: 'Contatos', url: '/contacts', icon: Users },
  { title: 'Categorias', url: '/categories', icon: Tag },
  { title: 'Orçamentos', url: '/budgets', icon: Target },
  { title: 'Relatórios', url: '/reports', icon: BarChart3 },
  { title: 'Assinatura', url: '/subscription', icon: Crown },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const { resetAllData, exportBackup, importBackup } = useFinance();
  const { settings: pixSettings } = usePixSettings();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  const handleSupportSubmit = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      toast.error('Preencha o assunto e a mensagem.');
      return;
    }

    setSendingSupport(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-support-email', {
        body: {
          subject: supportSubject,
          message: supportMessage
        }
      });

      if (error) throw new Error(error.message || 'Erro ao comunicar com o servidor');
      if (data?.error) throw new Error(data.error);

      toast.success('Mensagem enviada com sucesso! Retornaremos o contato em breve.');
      setSupportSubject('');
      setSupportMessage('');
      setSupportOpen(false);
    } catch (err: any) {
      console.error('[Support] Error sending message:', err);
      toast.error(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setSendingSupport(false);
    }
  };

  const salesEnabled = pixSettings.salesModuleEnabled;

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <div className="px-4 pt-8 pb-4 flex justify-center">
            {!collapsed && (
              <img src={logoE3Flow} alt="E3 Flow" className="h-24 w-auto object-contain rounded-2xl" />
            )}
            {collapsed && <img src={logoE3Flow} alt="E3 Flow" className="h-10 w-10 object-contain mx-auto rounded-xl" />}
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
                {salesEnabled && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/sales" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {!collapsed && <span>Vendas</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/products" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <Package className="h-4 w-4 mr-2" />
                          {!collapsed && <span>Produtos</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
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
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full">
                <MoreHorizontal className="h-4 w-4" />
                {!collapsed && (
                  <>
                    <span className="text-sm">Mais opções</span>
                    <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
              <NavLink to="/instalar" className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full">
                <Smartphone className="h-4 w-4" />
                {!collapsed && <span className="text-sm">Instalar App</span>}
              </NavLink>
              <button onClick={() => setSupportOpen(true)}
                className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-sidebar-foreground transition-colors w-full">
                <HelpCircle className="h-4 w-4" />
                {!collapsed && <span className="text-sm">Ajuda e Suporte</span>}
              </button>
              <button onClick={signOut}
                className="flex items-center gap-2 px-4 py-3 text-sidebar-muted hover:text-destructive transition-colors w-full">
                <LogOut className="h-4 w-4" />
                {!collapsed && <span className="text-sm">Sair</span>}
              </button>
            </CollapsibleContent>
          </Collapsible>

        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá apagar permanentemente todas as suas transações, {SAFE_LABELS.lowerPayables}, {SAFE_LABELS.lowerReceivables}, contas financeiras, contatos, orçamentos, categorias e configurações de recibo/PIX. Esta ação não pode ser desfeita.
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

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Ajuda e Suporte
            </DialogTitle>
            <DialogDescription>
              Precisa de ajuda ou encontrou algum problema? Envie uma mensagem diretamente para nossa equipe de suporte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input
                value={supportSubject}
                onChange={e => setSupportSubject(e.target.value)}
                placeholder="Ex: Dúvida sobre fechamento de caixa"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={supportMessage}
                onChange={e => setSupportMessage(e.target.value)}
                placeholder="Descreva o que está acontecendo com o máximo de detalhes possível..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSupportSubmit} disabled={sendingSupport} className="w-full sm:w-auto">
              {sendingSupport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {sendingSupport ? 'Enviando...' : 'Enviar Mensagem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
