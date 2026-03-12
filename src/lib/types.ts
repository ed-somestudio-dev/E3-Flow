export type TransactionType = 'income' | 'expense';
export type PayableStatus = 'pending' | 'paid' | 'overdue';
export type ReceivableStatus = 'pending' | 'received' | 'overdue';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card';

export interface FinancialAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  creditLimit?: number;
  billingCloseDay?: number;
  dueDay?: number;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  categoryId: string;
  amount: number;
  date: string;
  accountId: string;
  notes?: string;
}

export interface Payable {
  id: string;
  description: string;
  supplier: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  paymentMethod?: string;
  status: PayableStatus;
  notes?: string;
}

export interface Receivable {
  id: string;
  clientName: string;
  description: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  paymentMethod?: string;
  status: ReceivableStatus;
  notes?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: string; // YYYY-MM
}

export interface FinanceData {
  accounts: FinancialAccount[];
  categories: Category[];
  transactions: Transaction[];
  payables: Payable[];
  receivables: Receivable[];
  budgets: Budget[];
}
