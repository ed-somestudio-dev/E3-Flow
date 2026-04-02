import { FinanceData, FinancialAccount, Category, Transaction, Payable, Receivable, Budget } from './types';

const STORAGE_KEY = 'financeflow_data';

const defaultCategories: Category[] = [
  { id: 'cat-1', name: 'Vendas', type: 'income', icon: 'TrendingUp', color: '#0ea5e9' },
  { id: 'cat-2', name: 'Serviços', type: 'income', icon: 'Briefcase', color: '#8b5cf6' },
  { id: 'cat-3', name: 'Salário', type: 'income', icon: 'Wallet', color: '#10b981' },
  { id: 'cat-4', name: 'Outras Receitas', type: 'income', icon: 'Plus', color: '#6366f1' },
  { id: 'cat-5', name: 'Alimentação', type: 'expense', icon: 'UtensilsCrossed', color: '#f97316' },
  { id: 'cat-6', name: 'Transporte', type: 'expense', icon: 'Car', color: '#eab308' },
  { id: 'cat-7', name: 'Moradia', type: 'expense', icon: 'Home', color: '#ef4444' },
  { id: 'cat-8', name: 'Utilidades', type: 'expense', icon: 'Zap', color: '#14b8a6' },
  { id: 'cat-9', name: 'Internet', type: 'expense', icon: 'Wifi', color: '#3b82f6' },
  { id: 'cat-10', name: 'Impostos', type: 'expense', icon: 'Receipt', color: '#a855f7' },
  { id: 'cat-11', name: 'Outras Despesas', type: 'expense', icon: 'Minus', color: '#78716c' },
];

const defaultAccounts: FinancialAccount[] = [
  { id: 'acc-1', name: 'Conta Corrente', type: 'checking', balance: 5420.50, savingsBalance: 0, color: '#0ea5e9' },
  { id: 'acc-2', name: 'Poupança', type: 'savings', balance: 0, savingsBalance: 12000, color: '#10b981' },
  { id: 'acc-3', name: 'Dinheiro', type: 'cash', balance: 350, savingsBalance: 0, color: '#eab308' },
];

const today = new Date();
const fmtd = (d: Date) => d.toISOString().split('T')[0];
const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmtd(d); };
const daysFromNow = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmtd(d); };

const defaultTransactions: Transaction[] = [
  { id: 'tx-1', type: 'income', description: 'Pagamento de cliente', categoryId: 'cat-1', amount: 3200, date: daysAgo(2), accountId: 'acc-1' },
  { id: 'tx-2', type: 'income', description: 'Salário mensal', categoryId: 'cat-3', amount: 5500, date: daysAgo(5), accountId: 'acc-1' },
  { id: 'tx-3', type: 'expense', description: 'Supermercado', categoryId: 'cat-5', amount: 185.40, date: daysAgo(1), accountId: 'acc-1' },
  { id: 'tx-4', type: 'expense', description: 'Combustível', categoryId: 'cat-6', amount: 65, date: daysAgo(3), accountId: 'acc-1' },
  { id: 'tx-5', type: 'expense', description: 'Conta de luz', categoryId: 'cat-8', amount: 120, date: daysAgo(7), accountId: 'acc-1' },
  { id: 'tx-6', type: 'income', description: 'Projeto freelance', categoryId: 'cat-2', amount: 1500, date: daysAgo(10), accountId: 'acc-1' },
  { id: 'tx-7', type: 'expense', description: 'Aluguel', categoryId: 'cat-7', amount: 1800, date: daysAgo(15), accountId: 'acc-1' },
  { id: 'tx-8', type: 'expense', description: 'Conta de internet', categoryId: 'cat-9', amount: 79.99, date: daysAgo(12), accountId: 'acc-1' },
];

const defaultPayables: Payable[] = [
  { id: 'pay-1', description: 'Material de escritório', supplier: 'Kalunga', categoryId: 'cat-11', amount: 245, dueDate: daysFromNow(5), status: 'pending' },
  { id: 'pay-2', description: 'Assinatura software', supplier: 'Adobe', categoryId: 'cat-9', amount: 54.99, dueDate: daysAgo(2), status: 'overdue' },
  { id: 'pay-3', description: 'Conta telefone', supplier: 'Operadora', categoryId: 'cat-8', amount: 89, dueDate: daysAgo(10), paymentDate: daysAgo(9), status: 'paid' },
  { id: 'pay-4', description: 'Aluguel mensal', supplier: 'Imobiliária', categoryId: 'cat-7', amount: 1800, dueDate: daysFromNow(15), status: 'pending', recurring: true, recurrenceFrequency: 'monthly' },
  { id: 'pay-5', description: 'Internet fibra', supplier: 'Provedor', categoryId: 'cat-9', amount: 119.90, dueDate: daysFromNow(8), status: 'pending', recurring: true, recurrenceFrequency: 'monthly' },
];

const defaultReceivables: Receivable[] = [
  { id: 'rec-1', clientName: 'Empresa ABC', description: 'Desenvolvimento web', categoryId: 'cat-2', amount: 4500, dueDate: daysFromNow(10), status: 'pending' },
  { id: 'rec-2', clientName: 'Silva Ltda', description: 'Consultoria', categoryId: 'cat-2', amount: 1200, dueDate: daysAgo(3), status: 'overdue' },
  { id: 'rec-3', clientName: 'Maria Santos', description: 'Design gráfico', categoryId: 'cat-2', amount: 800, dueDate: daysAgo(15), paymentDate: daysAgo(14), status: 'received' },
];

const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const defaultBudgets: Budget[] = [
  { id: 'bud-1', categoryId: 'cat-5', amount: 500, month: currentMonth },
  { id: 'bud-2', categoryId: 'cat-6', amount: 200, month: currentMonth },
  { id: 'bud-3', categoryId: 'cat-7', amount: 2000, month: currentMonth },
  { id: 'bud-4', categoryId: 'cat-8', amount: 300, month: currentMonth },
];

const defaultData: FinanceData = {
  accounts: defaultAccounts,
  categories: defaultCategories,
  transactions: defaultTransactions,
  payables: defaultPayables,
  receivables: defaultReceivables,
  budgets: defaultBudgets,
};

export function loadData(): FinanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  saveData(defaultData);
  return defaultData;
}

export function resetData(): FinanceData {
  saveData(defaultData);
  return defaultData;
}

export function saveData(data: FinanceData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
