import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FinanceData, FinancialAccount, Transaction, Payable, Receivable, Budget } from './types';
import { loadData, saveData, generateId } from './store';

interface FinanceContextType {
  data: FinanceData;
  // Transactions
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  // Payables
  addPayable: (p: Omit<Payable, 'id'>) => void;
  updatePayable: (p: Payable) => void;
  deletePayable: (id: string) => void;
  markPayablePaid: (id: string) => void;
  // Receivables
  addReceivable: (r: Omit<Receivable, 'id'>) => void;
  updateReceivable: (r: Receivable) => void;
  deleteReceivable: (id: string) => void;
  markReceivableReceived: (id: string) => void;
  // Accounts
  addAccount: (a: Omit<FinancialAccount, 'id'>) => void;
  updateAccount: (a: FinancialAccount) => void;
  deleteAccount: (id: string) => void;
  // Budgets
  addBudget: (b: Omit<Budget, 'id'>) => void;
  updateBudget: (b: Budget) => void;
  deleteBudget: (id: string) => void;
  // Helpers
  getCategoryName: (id: string) => string;
  getAccountName: (id: string) => string;
  getCategoryColor: (id: string) => string;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FinanceData>(loadData);

  useEffect(() => { saveData(data); }, [data]);

  // Auto-detect overdue
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setData(prev => ({
      ...prev,
      payables: prev.payables.map(p =>
        p.status === 'pending' && p.dueDate < today ? { ...p, status: 'overdue' as const } : p
      ),
      receivables: prev.receivables.map(r =>
        r.status === 'pending' && r.dueDate < today ? { ...r, status: 'overdue' as const } : r
      ),
    }));
  }, []);

  const update = useCallback((fn: (prev: FinanceData) => FinanceData) => setData(fn), []);

  const addTransaction = useCallback((tx: Omit<Transaction, 'id'>) => {
    update(prev => ({ ...prev, transactions: [...prev.transactions, { ...tx, id: generateId() }] }));
  }, [update]);
  const updateTransaction = useCallback((tx: Transaction) => {
    update(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === tx.id ? tx : t) }));
  }, [update]);
  const deleteTransaction = useCallback((id: string) => {
    update(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
  }, [update]);

  const addPayable = useCallback((p: Omit<Payable, 'id'>) => {
    update(prev => ({ ...prev, payables: [...prev.payables, { ...p, id: generateId() }] }));
  }, [update]);
  const updatePayable = useCallback((p: Payable) => {
    update(prev => ({ ...prev, payables: prev.payables.map(x => x.id === p.id ? p : x) }));
  }, [update]);
  const deletePayable = useCallback((id: string) => {
    update(prev => ({ ...prev, payables: prev.payables.filter(x => x.id !== id) }));
  }, [update]);
  const markPayablePaid = useCallback((id: string) => {
    const today = new Date().toISOString().split('T')[0];
    update(prev => ({ ...prev, payables: prev.payables.map(x => x.id === id ? { ...x, status: 'paid' as const, paymentDate: today } : x) }));
  }, [update]);

  const addReceivable = useCallback((r: Omit<Receivable, 'id'>) => {
    update(prev => ({ ...prev, receivables: [...prev.receivables, { ...r, id: generateId() }] }));
  }, [update]);
  const updateReceivable = useCallback((r: Receivable) => {
    update(prev => ({ ...prev, receivables: prev.receivables.map(x => x.id === r.id ? r : x) }));
  }, [update]);
  const deleteReceivable = useCallback((id: string) => {
    update(prev => ({ ...prev, receivables: prev.receivables.filter(x => x.id !== id) }));
  }, [update]);
  const markReceivableReceived = useCallback((id: string) => {
    const today = new Date().toISOString().split('T')[0];
    update(prev => ({ ...prev, receivables: prev.receivables.map(x => x.id === id ? { ...x, status: 'received' as const, paymentDate: today } : x) }));
  }, [update]);

  const addAccount = useCallback((a: Omit<FinancialAccount, 'id'>) => {
    update(prev => ({ ...prev, accounts: [...prev.accounts, { ...a, id: generateId() }] }));
  }, [update]);
  const updateAccount = useCallback((a: FinancialAccount) => {
    update(prev => ({ ...prev, accounts: prev.accounts.map(x => x.id === a.id ? a : x) }));
  }, [update]);
  const deleteAccount = useCallback((id: string) => {
    update(prev => ({ ...prev, accounts: prev.accounts.filter(x => x.id !== id) }));
  }, [update]);

  const addBudget = useCallback((b: Omit<Budget, 'id'>) => {
    update(prev => ({ ...prev, budgets: [...prev.budgets, { ...b, id: generateId() }] }));
  }, [update]);
  const updateBudget = useCallback((b: Budget) => {
    update(prev => ({ ...prev, budgets: prev.budgets.map(x => x.id === b.id ? b : x) }));
  }, [update]);
  const deleteBudget = useCallback((id: string) => {
    update(prev => ({ ...prev, budgets: prev.budgets.filter(x => x.id !== id) }));
  }, [update]);

  const getCategoryName = useCallback((id: string) => data.categories.find(c => c.id === id)?.name || 'Unknown', [data.categories]);
  const getAccountName = useCallback((id: string) => data.accounts.find(a => a.id === id)?.name || 'Unknown', [data.accounts]);
  const getCategoryColor = useCallback((id: string) => data.categories.find(c => c.id === id)?.color || '#888', [data.categories]);

  return (
    <FinanceContext.Provider value={{
      data, addTransaction, updateTransaction, deleteTransaction,
      addPayable, updatePayable, deletePayable, markPayablePaid,
      addReceivable, updateReceivable, deleteReceivable, markReceivableReceived,
      addAccount, updateAccount, deleteAccount,
      addBudget, updateBudget, deleteBudget,
      getCategoryName, getAccountName, getCategoryColor,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
