export type TransactionType = 'income' | 'expense';
export type PayableStatus = 'pending' | 'paid' | 'overdue';
export type ReceivableStatus = 'pending' | 'received' | 'overdue';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card';
export type RecurrenceFrequency = 'monthly' | 'weekly' | 'yearly';

export interface FinancialAccount {
  id: string;
  name: string;
  type: string; // comma-separated: 'checking', 'savings', 'credit_card', 'cash'
  balance: number;
  savingsBalance: number;
  creditLimit?: number;
  creditUsed?: number;
  billingCloseDay?: number;
  dueDay?: number;
  color: string;
}

export function getAccountTypes(account: FinancialAccount): AccountType[] {
  return account.type.split(',').filter(Boolean) as AccountType[];
}

export function hasAccountType(account: FinancialAccount, type: AccountType): boolean {
  return getAccountTypes(account).includes(type);
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
  isCredit?: boolean;
}

export interface Payable {
  id: string;
  description: string;
  supplier: string;
  categoryId: string;
  accountId?: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  paymentMethod?: string;
  status: PayableStatus;
  notes?: string;
  purchaseDate?: string;
  recurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
}

export interface Receivable {
  id: string;
  clientName: string;
  description: string;
  categoryId: string;
  accountId?: string;
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
  month: string;
}

export interface FinanceData {
  accounts: FinancialAccount[];
  categories: Category[];
  transactions: Transaction[];
  payables: Payable[];
  receivables: Receivable[];
  budgets: Budget[];
}
