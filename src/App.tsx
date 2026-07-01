import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SubscriptionProvider, useSubscription } from "@/lib/subscription-context";
import { FinanceProvider } from "@/lib/finance-context";
import { PixSettingsProvider } from "@/lib/pix-settings-context";
import { ContactsProvider } from "@/lib/contacts-context";
import { SalesProvider } from "@/lib/sales-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AppLayout } from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import TransactionsPage from "@/pages/TransactionsPage";
import PayablesPage from "@/pages/PayablesPage";
import ReceivablesPage from "@/pages/ReceivablesPage";
import AccountsPage from "@/pages/AccountsPage";
import BudgetsPage from "@/pages/BudgetsPage";
import ReportsPage from "@/pages/ReportsPage";
import CategoriesPage from "@/pages/CategoriesPage";
import SettingsPage from "@/pages/SettingsPage";
import ContactsPage from "@/pages/ContactsPage";
import SalesPage from "@/pages/SalesPage";
import ProductsPage from "@/pages/ProductsPage";
import InstallPage from "@/pages/InstallPage";
import AuthPage from "@/pages/AuthPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import SubscriptionPage from "@/pages/SubscriptionPage";
import WelcomeSubscriptionPage from "@/pages/WelcomeSubscriptionPage";
import AdminSubscriptionsPage from "@/pages/AdminSubscriptionsPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/NotFound";
import logoE3Flow from '@/assets/Logo_E3Flow_Final.png';

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { loading: subLoading, isActive, isAdmin, subscription } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();

  // Monitora se o usuário acabou de ir para o Asaas e voltou
  useEffect(() => {
    const checkWelcome = () => {
      if (localStorage.getItem('pendingWelcome') === 'true') {
        if (subscription?.subscription_status === 'RECEIVED' || subscription?.subscription_status === 'CONFIRMED') {
          localStorage.removeItem('pendingWelcome');
          navigate('/bem-vindo');
        }
      }
    };

    // Checa ao montar
    checkWelcome();

    // Checa ao voltar para a aba (caso o navegador restaure a página do cache - bfcache)
    window.addEventListener('pageshow', checkWelcome);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkWelcome();
    });

    return () => {
      window.removeEventListener('pageshow', checkWelcome);
    };
  }, [subscription?.subscription_status, navigate]);

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src={logoE3Flow} alt="E3 Flow" className="h-48 object-contain animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Se não estiver ativo e não estiver na página de assinatura (ou admin se for admin), redirecionar
  // Também permitimos a rota /bem-vindo sem redirecionar
  if (!isActive && location.pathname !== '/subscription' && location.pathname !== '/bem-vindo') {
    if (!isAdmin || (isAdmin && location.pathname !== '/admin/subscriptions')) {
       return <Navigate to="/subscription" replace />;
    }
  }

  return (
    <PixSettingsProvider>
      <FinanceProvider>
        <ContactsProvider>
          <SalesProvider>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/payables" element={<PayablesPage />} />
                <Route path="/receivables" element={<ErrorBoundary><ReceivablesPage /></ErrorBoundary>} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route path="/budgets" element={<BudgetsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/instalar" element={<InstallPage />} />
                <Route path="/subscription" element={<SubscriptionPage />} />
                <Route path="/bem-vindo" element={<WelcomeSubscriptionPage />} />
                {isAdmin && <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </SalesProvider>
        </ContactsProvider>
      </FinanceProvider>
    </PixSettingsProvider>
  );
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <SubscriptionProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </BrowserRouter>
          </SubscriptionProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

