export type TransactionType = 'income' | 'expense';
export type PayableStatus = 'pending' | 'paid' | 'overdue';
export type ReceivableStatus = 'pending' | 'received' | 'overdue';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card';
export type RecurrenceFrequency = 'monthly' | 'weekly' | 'yearly';
export type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'preparing' | 'dispatched' | 'delivered';

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
  interestAmount?: number;
  discountAmount?: number;
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
  interestAmount?: number;
  discountAmount?: number;
  notes?: string;
  recurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  notes?: string;
  address?: string;
  cep?: string;
}

export interface FinanceData {
  accounts: FinancialAccount[];
  categories: Category[];
  transactions: Transaction[];
  payables: Payable[];
  receivables: Receivable[];
  budgets: Budget[];
  contacts: Contact[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  unit: string;
  categoryId?: string;
  active: boolean;
  imageUrl?: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  clientName?: string;
  status: SaleStatus;
  total: number;
  discountAmount?: number;
  paymentMethod?: string;
  notes?: string;
  saleDate: string;
  receivableId?: string;
  trackingCode?: string;
  carrier?: string;
  shippingCost?: number;
  estimatedDelivery?: string;
  requiresShipping?: boolean;
  items: SaleItem[];
  createdAt: string;
}
