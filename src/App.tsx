import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { FinanceProvider } from "@/lib/finance-context";
import { PixSettingsProvider } from "@/lib/pix-settings-context";
import { ContactsProvider } from "@/lib/contacts-context";
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
import InstallPage from "@/pages/InstallPage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/NotFound";
import logoFluxoPro from '@/assets/Logo_FluxoPro.png';

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src={logoFluxoPro} alt="FluxoPro" className="h-48 object-contain animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <PixSettingsProvider>
      <FinanceProvider>
        <ContactsProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/payables" element={<PayablesPage />} />
              <Route path="/receivables" element={<ReceivablesPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/instalar" element={<InstallPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
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
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
