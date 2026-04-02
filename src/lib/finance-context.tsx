import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FinanceData, FinancialAccount, Transaction, Payable, Receivable, Budget, Category } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { toast } from 'sonner';

interface FinanceContextType {
  data: FinanceData;
  loading: boolean;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addPayable: (p: Omit<Payable, 'id'>, installments?: number) => Promise<void>;
  updatePayable: (p: Payable) => Promise<void>;
  deletePayable: (id: string) => Promise<void>;
  markPayablePaid: (id: string, accountId?: string) => Promise<void>;
  addReceivable: (r: Omit<Receivable, 'id'>, installments?: number) => Promise<void>;
  updateReceivable: (r: Receivable) => Promise<void>;
  deleteReceivable: (id: string) => Promise<void>;
  markReceivableReceived: (id: string, accountId?: string) => Promise<void>;
  addAccount: (a: Omit<FinancialAccount, 'id'>) => Promise<void>;
  updateAccount: (a: FinancialAccount) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  transferBetweenAccounts: (fromId: string, toId: string, amount: number) => Promise<void>;
  addBudget: (b: Omit<Budget, 'id'>) => Promise<void>;
  updateBudget: (b: Budget) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addCategory: (c: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (c: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  getCategoryName: (id: string) => string;
  getAccountName: (id: string) => string;
  getCategoryColor: (id: string) => string;
  resetAllData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

const emptyData: FinanceData = {
  accounts: [], categories: [], transactions: [], payables: [], receivables: [], budgets: [],
};

const defaultCategories: Omit<Category, 'id'>[] = [
  { name: 'Vendas', type: 'income', icon: 'TrendingUp', color: '#0ea5e9' },
  { name: 'Serviços', type: 'income', icon: 'Briefcase', color: '#8b5cf6' },
  { name: 'Salário', type: 'income', icon: 'Wallet', color: '#10b981' },
  { name: 'Outras Receitas', type: 'income', icon: 'Plus', color: '#6366f1' },
  { name: 'Alimentação', type: 'expense', icon: 'UtensilsCrossed', color: '#f97316' },
  { name: 'Transporte', type: 'expense', icon: 'Car', color: '#eab308' },
  { name: 'Moradia', type: 'expense', icon: 'Home', color: '#ef4444' },
  { name: 'Utilidades', type: 'expense', icon: 'Zap', color: '#14b8a6' },
  { name: 'Internet', type: 'expense', icon: 'Wifi', color: '#3b82f6' },
  { name: 'Impostos', type: 'expense', icon: 'Receipt', color: '#a855f7' },
  { name: 'Outras Despesas', type: 'expense', icon: 'Minus', color: '#78716c' },
];

function mapAccount(row: any): FinancialAccount {
  return {
    id: row.id, name: row.name, type: row.type, balance: Number(row.balance),
    savingsBalance: Number(row.savings_balance || 0),
    color: row.color, creditLimit: row.credit_limit ? Number(row.credit_limit) : undefined,
    billingCloseDay: row.billing_close_day ?? undefined, dueDay: row.due_day ?? undefined,
  };
}

function mapTransaction(row: any): Transaction {
  return {
    id: row.id, type: row.type, description: row.description,
    categoryId: row.category_id, amount: Number(row.amount),
    date: row.date, accountId: row.account_id, notes: row.notes ?? undefined,
    isCredit: row.is_credit ?? false,
  };
}

function mapPayable(row: any): Payable {
  const today = new Date().toISOString().split('T')[0];
  let status = row.status;
  if (status === 'pending' && row.due_date < today) status = 'overdue';
  return {
    id: row.id, description: row.description, supplier: row.supplier,
    categoryId: row.category_id, accountId: row.account_id ?? undefined,
    amount: Number(row.amount), dueDate: row.due_date, paymentDate: row.payment_date ?? undefined,
    paymentMethod: row.payment_method ?? undefined, status,
    notes: row.notes ?? undefined, recurring: row.recurring ?? undefined,
    recurrenceFrequency: row.recurrence_frequency ?? undefined,
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
  };
}

function mapReceivable(row: any): Receivable {
  const today = new Date().toISOString().split('T')[0];
  let status = row.status;
  if (status === 'pending' && row.due_date < today) status = 'overdue';
  return {
    id: row.id, clientName: row.client_name, description: row.description,
    categoryId: row.category_id, accountId: row.account_id ?? undefined,
    amount: Number(row.amount), dueDate: row.due_date, paymentDate: row.payment_date ?? undefined,
    paymentMethod: row.payment_method ?? undefined, status,
    notes: row.notes ?? undefined,
  };
}

function mapCategory(row: any): Category {
  return { id: row.id, name: row.name, type: row.type, icon: row.icon, color: row.color };
}

function mapBudget(row: any): Budget {
  return { id: row.id, categoryId: row.category_id, amount: Number(row.amount), month: row.month };
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<FinanceData>(emptyData);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) { setData(emptyData); setLoading(false); return; }
    setLoading(true);
    try {
      const [cats, accs, txs, pays, recs, buds] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('financial_accounts').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('payables').select('*').eq('user_id', user.id).order('due_date'),
        supabase.from('receivables').select('*').eq('user_id', user.id).order('due_date'),
        supabase.from('budgets').select('*').eq('user_id', user.id),
      ]);

      let categories = (cats.data || []).map(mapCategory);

      // Seed default categories for new users
      if (categories.length === 0) {
        const inserts = defaultCategories.map(c => ({ ...c, user_id: user.id }));
        const { data: inserted } = await supabase.from('categories').insert(inserts).select();
        categories = (inserted || []).map(mapCategory);
      }

      setData({
        categories,
        accounts: (accs.data || []).map(mapAccount),
        transactions: (txs.data || []).map(mapTransaction),
        payables: (pays.data || []).map(mapPayable),
        receivables: (recs.data || []).map(mapReceivable),
        budgets: (buds.data || []).map(mapBudget),
      });
    } catch (err) {
      console.error('Failed to fetch data:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- Transactions ---
  const addTransaction = useCallback(async (tx: Omit<Transaction, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id, type: tx.type, description: tx.description,
      category_id: tx.categoryId, amount: tx.amount, date: tx.date,
      account_id: tx.accountId, notes: tx.notes || null,
      is_credit: tx.isCredit || false,
    } as any);
    if (error) { toast.error('Erro ao criar transação'); return; }

    const acc = data.accounts.find(a => a.id === tx.accountId);
    if (tx.isCredit && acc?.type?.includes('credit_card')) {
      // Credit card purchase: reduce available balance (balance = available limit)
      await supabase.from('financial_accounts').update({ balance: acc.balance - tx.amount }).eq('id', tx.accountId);
      // Auto-create/update fatura payable
      await upsertCreditCardInvoice(acc, tx.amount, tx.date);
    } else {
      // Regular transaction: update account balance
      const delta = tx.type === 'income' ? tx.amount : -tx.amount;
      if (acc) await supabase.from('financial_accounts').update({ balance: acc.balance + delta }).eq('id', tx.accountId);
    }
    await fetchAll();
  }, [user, data, fetchAll]);

  const upsertCreditCardInvoice = useCallback(async (acc: FinancialAccount, amount: number, txDate: string) => {
    if (!user) return;
    const closeDay = acc.billingCloseDay || 1;
    const dueDay = acc.dueDay || 10;
    const d = new Date(txDate + 'T12:00:00');
    // Determine billing cycle: if day > closeDay, invoice is for next month
    let invoiceMonth: number, invoiceYear: number;
    if (d.getDate() > closeDay) {
      invoiceMonth = d.getMonth() + 2; // next month (1-indexed)
      invoiceYear = d.getFullYear();
    } else {
      invoiceMonth = d.getMonth() + 1;
      invoiceYear = d.getFullYear();
    }
    if (invoiceMonth > 12) { invoiceMonth = 1; invoiceYear++; }
    const invoiceKey = `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
    const dueDate = `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    const description = `Fatura ${acc.name} - ${String(invoiceMonth).padStart(2, '0')}/${invoiceYear}`;

    // Check if payable already exists for this card + cycle
    const { data: existing } = await supabase.from('payables')
      .select('*')
      .eq('user_id', user.id)
      .eq('supplier', `cartao:${acc.id}`)
      .eq('due_date', dueDate)
      .maybeSingle();

    if (existing) {
      await supabase.from('payables').update({
        amount: Number(existing.amount) + amount,
        description,
      }).eq('id', existing.id);
    } else {
      // Find an expense category for the invoice
      const cat = data.categories.find(c => c.type === 'expense');
      if (!cat) return;
      await supabase.from('payables').insert({
        user_id: user.id, description, supplier: `cartao:${acc.id}`,
        category_id: cat.id, account_id: acc.id,
        amount, due_date: dueDate, status: 'pending',
      });
    }
  }, [user, data.categories]);

  const updateTransaction = useCallback(async (tx: Transaction) => {
    if (!user) return;
    // Get old transaction to reverse balance
    const old = data.transactions.find(t => t.id === tx.id);
    if (old) {
      const oldDelta = old.type === 'income' ? -old.amount : old.amount;
      await supabase.from('financial_accounts').update({ balance: data.accounts.find(a => a.id === old.accountId)!.balance + oldDelta }).eq('id', old.accountId);
    }
    await supabase.from('transactions').update({
      type: tx.type, description: tx.description, category_id: tx.categoryId,
      amount: tx.amount, date: tx.date, account_id: tx.accountId, notes: tx.notes || null,
    }).eq('id', tx.id);
    if (old) {
      const newDelta = tx.type === 'income' ? tx.amount : -tx.amount;
      const acc = data.accounts.find(a => a.id === tx.accountId);
      const oldDelta = old.type === 'income' ? -old.amount : old.amount;
      const currentBalance = acc ? (acc.id === old.accountId ? acc.balance + oldDelta : acc.balance) : 0;
      await supabase.from('financial_accounts').update({ balance: currentBalance + newDelta }).eq('id', tx.accountId);
    }
    await fetchAll();
  }, [user, data, fetchAll]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!user) return;
    const tx = data.transactions.find(t => t.id === id);
    await supabase.from('transactions').delete().eq('id', id);
    if (tx) {
      const delta = tx.type === 'income' ? -tx.amount : tx.amount;
      const acc = data.accounts.find(a => a.id === tx.accountId);
      if (acc) await supabase.from('financial_accounts').update({ balance: acc.balance + delta }).eq('id', tx.accountId);
    }
    await fetchAll();
  }, [user, data, fetchAll]);

  // --- Payables ---
  const addPayable = useCallback(async (p: Omit<Payable, 'id'>, installments?: number) => {
    if (!user) return;

    if (installments && installments > 1) {
      // Credit card installments: create one payable per month
      const installmentAmount = Math.round((p.amount / installments) * 100) / 100;
      const baseDate = new Date(p.dueDate + 'T12:00:00');
      const acc = p.accountId ? data.accounts.find(a => a.id === p.accountId) : undefined;

      for (let i = 0; i < installments; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const desc = `${p.description} (${i + 1}/${installments})`;

        // If it's a credit card, upsert into the card's invoice
        if (acc?.type?.includes('credit_card')) {
          await upsertCreditCardInvoice(acc, installmentAmount, dueStr);
        } else {
          await supabase.from('payables').insert({
            user_id: user.id, description: desc, supplier: p.supplier,
            category_id: p.categoryId, account_id: p.accountId || null,
            amount: installmentAmount, due_date: dueStr, status: 'pending',
            notes: p.notes || null,
          });
        }
      }
      // Also reduce credit card available limit by total amount
      if (acc?.type?.includes('credit_card') && acc.creditLimit != null) {
        await supabase.from('financial_accounts').update({ credit_limit: acc.creditLimit - p.amount }).eq('id', acc.id);
      }
      await fetchAll();
      return;
    }

    const { error } = await supabase.from('payables').insert({
      user_id: user.id, description: p.description, supplier: p.supplier,
      category_id: p.categoryId, account_id: p.accountId || null,
      amount: p.amount, due_date: p.dueDate, status: p.status,
      notes: p.notes || null, recurring: p.recurring || false,
      recurrence_frequency: p.recurrenceFrequency || null,
      recurrence_end_date: p.recurrenceEndDate || null,
    });
    if (error) { console.error('addPayable error:', error); toast.error('Erro ao criar conta a pagar'); return; }
    await fetchAll();
  }, [user, data, fetchAll, upsertCreditCardInvoice]);

  const updatePayable = useCallback(async (p: Payable) => {
    if (!user) return;
    const { error } = await supabase.from('payables').update({
      description: p.description, supplier: p.supplier,
      category_id: p.categoryId, account_id: p.accountId || null,
      amount: p.amount, due_date: p.dueDate, status: p.status,
      notes: p.notes || null, recurring: p.recurring || false,
      recurrence_frequency: p.recurrenceFrequency || null,
      recurrence_end_date: p.recurrenceEndDate || null,
    }).eq('id', p.id).eq('user_id', user.id);
    if (error) { console.error('updatePayable error:', error); toast.error('Erro ao atualizar conta a pagar'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const deletePayable = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('payables').delete().eq('id', id).eq('user_id', user.id);
    if (error) { console.error('deletePayable error:', error); toast.error('Erro ao excluir conta a pagar'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const markPayablePaid = useCallback(async (id: string, accountId?: string) => {
    if (!user) return;
    const payable = data.payables.find(x => x.id === id);
    const targetAccountId = accountId || payable?.accountId;
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('payables').update({
      status: 'paid', payment_date: today, account_id: targetAccountId || null,
    }).eq('id', id).eq('user_id', user.id);
    if (error) { console.error('markPayablePaid error:', error); toast.error('Erro ao marcar como pago'); return; }
    if (payable && targetAccountId) {
      const acc = data.accounts.find(a => a.id === targetAccountId);
      if (acc) {
        const isCreditCard = acc.type.includes('credit_card');
        if (isCreditCard && acc.creditLimit != null) {
          // Diminui do limite disponível do cartão
          await supabase.from('financial_accounts').update({ credit_limit: acc.creditLimit - payable.amount }).eq('id', targetAccountId);
        } else {
          await supabase.from('financial_accounts').update({ balance: acc.balance - payable.amount }).eq('id', targetAccountId);
        }
      }
      // Criar transação de despesa automaticamente
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'expense',
        description: payable.description,
        category_id: payable.categoryId,
        amount: payable.amount,
        date: today,
        account_id: targetAccountId,
        notes: `Pagamento: ${payable.supplier || ''}`.trim(),
      });
    }
    await fetchAll();
  }, [user, data, fetchAll]);

  // --- Receivables ---
  const addReceivable = useCallback(async (r: Omit<Receivable, 'id'>, installments?: number) => {
    if (!user) return;

    if (installments && installments > 1) {
      const installmentAmount = Math.round((r.amount / installments) * 100) / 100;
      const baseDate = new Date(r.dueDate + 'T12:00:00');

      for (let i = 0; i < installments; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const desc = `${r.description} (${i + 1}/${installments})`;

        await supabase.from('receivables').insert({
          user_id: user.id, client_name: r.clientName, description: desc,
          category_id: r.categoryId, account_id: r.accountId || null,
          amount: installmentAmount, due_date: dueStr, status: 'pending',
          notes: r.notes || null,
        });
      }
      await fetchAll();
      return;
    }

    const { error } = await supabase.from('receivables').insert({
      user_id: user.id, client_name: r.clientName, description: r.description,
      category_id: r.categoryId, account_id: r.accountId || null,
      amount: r.amount, due_date: r.dueDate, status: r.status,
      notes: r.notes || null,
    });
    if (error) { console.error('addReceivable error:', error); toast.error('Erro ao criar conta a receber'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const updateReceivable = useCallback(async (r: Receivable) => {
    if (!user) return;
    const { error } = await supabase.from('receivables').update({
      client_name: r.clientName, description: r.description,
      category_id: r.categoryId, account_id: r.accountId || null,
      amount: r.amount, due_date: r.dueDate, status: r.status,
      notes: r.notes || null,
    }).eq('id', r.id).eq('user_id', user.id);
    if (error) { console.error('updateReceivable error:', error); toast.error('Erro ao atualizar conta a receber'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const deleteReceivable = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('receivables').delete().eq('id', id).eq('user_id', user.id);
    if (error) { console.error('deleteReceivable error:', error); toast.error('Erro ao excluir conta a receber'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const markReceivableReceived = useCallback(async (id: string, accountId?: string) => {
    if (!user) return;
    const receivable = data.receivables.find(x => x.id === id);
    const targetAccountId = accountId || receivable?.accountId;
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('receivables').update({
      status: 'received', payment_date: today, account_id: targetAccountId || null,
    }).eq('id', id).eq('user_id', user.id);
    if (error) { console.error('markReceivableReceived error:', error); toast.error('Erro ao marcar como recebido'); return; }
    if (receivable && targetAccountId) {
      const acc = data.accounts.find(a => a.id === targetAccountId);
      if (acc) await supabase.from('financial_accounts').update({ balance: acc.balance + receivable.amount }).eq('id', targetAccountId);
      // Criar transação de receita automaticamente
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'income',
        description: receivable.description,
        category_id: receivable.categoryId,
        amount: receivable.amount,
        date: today,
        account_id: targetAccountId,
        notes: `Recebimento: ${receivable.clientName || ''}`.trim(),
      });
    }
    await fetchAll();
  }, [user, data, fetchAll]);

  // --- Accounts ---
  const addAccount = useCallback(async (a: Omit<FinancialAccount, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('financial_accounts').insert({
      user_id: user.id, name: a.name, type: a.type, balance: a.balance,
      savings_balance: a.savingsBalance || 0,
      color: a.color, credit_limit: a.creditLimit || null,
      billing_close_day: a.billingCloseDay || null, due_day: a.dueDay || null,
    });
    if (error) { console.error('addAccount error:', error); toast.error('Erro ao criar conta'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const updateAccount = useCallback(async (a: FinancialAccount) => {
    if (!user) return;
    const { error } = await supabase.from('financial_accounts').update({
      name: a.name, type: a.type, balance: a.balance,
      savings_balance: a.savingsBalance || 0,
      color: a.color, credit_limit: a.creditLimit || null,
      billing_close_day: a.billingCloseDay || null, due_day: a.dueDay || null,
    }).eq('id', a.id).eq('user_id', user.id);
    if (error) { console.error('updateAccount error:', error); toast.error('Erro ao atualizar conta'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const deleteAccount = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('financial_accounts').delete().eq('id', id).eq('user_id', user.id);
    if (error) { console.error('deleteAccount error:', error); toast.error('Não é possível excluir conta com transações vinculadas'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const transferBetweenAccounts = useCallback(async (fromId: string, toId: string, amount: number) => {
    if (!user) return;
    const fromAcc = data.accounts.find(a => a.id === fromId);
    const toAcc = data.accounts.find(a => a.id === toId);
    if (!fromAcc || !toAcc) return;
    await Promise.all([
      supabase.from('financial_accounts').update({ balance: fromAcc.balance - amount }).eq('id', fromId),
      supabase.from('financial_accounts').update({ balance: toAcc.balance + amount }).eq('id', toId),
    ]);
    await fetchAll();
  }, [user, data, fetchAll]);

  // --- Budgets ---
  const addBudget = useCallback(async (b: Omit<Budget, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('budgets').insert({
      user_id: user.id, category_id: b.categoryId, amount: b.amount, month: b.month,
    });
    if (error) { console.error('addBudget error:', error); toast.error('Erro ao criar orçamento'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const updateBudget = useCallback(async (b: Budget) => {
    if (!user) return;
    const { error } = await supabase.from('budgets').update({ category_id: b.categoryId, amount: b.amount, month: b.month }).eq('id', b.id).eq('user_id', user.id);
    if (error) { console.error('updateBudget error:', error); toast.error('Erro ao atualizar orçamento'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const deleteBudget = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', user.id);
    if (error) { console.error('deleteBudget error:', error); toast.error('Erro ao excluir orçamento'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  // --- Categories ---
  const addCategory = useCallback(async (c: Omit<Category, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('categories').insert({
      user_id: user.id, name: c.name, type: c.type, icon: c.icon, color: c.color,
    });
    if (error) { toast.error('Erro ao criar categoria'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const updateCategory = useCallback(async (c: Category) => {
    if (!user) return;
    const { error } = await supabase.from('categories').update({
      name: c.name, type: c.type, icon: c.icon, color: c.color,
    }).eq('id', c.id).eq('user_id', user.id);
    if (error) { toast.error('Erro ao atualizar categoria'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id);
    if (error) { toast.error('Não é possível excluir categoria com dados vinculados'); return; }
    await fetchAll();
  }, [user, fetchAll]);

  const getCategoryName = useCallback((id: string) => data.categories.find(c => c.id === id)?.name || 'Desconhecido', [data.categories]);
  const getAccountName = useCallback((id: string) => data.accounts.find(a => a.id === id)?.name || 'Desconhecido', [data.accounts]);
  const getCategoryColor = useCallback((id: string) => data.categories.find(c => c.id === id)?.color || '#888', [data.categories]);

  const resetAllData = useCallback(async () => {
    if (!user) return;
    // Delete in order to respect foreign keys: transactions first, then payables/receivables/budgets, then accounts/categories
    await supabase.from('transactions').delete().eq('user_id', user.id);
    await supabase.from('payables').delete().eq('user_id', user.id);
    await supabase.from('receivables').delete().eq('user_id', user.id);
    await supabase.from('budgets').delete().eq('user_id', user.id);
    await supabase.from('financial_accounts').delete().eq('user_id', user.id);
    await supabase.from('categories').delete().eq('user_id', user.id);
    toast.success('Todos os dados foram reiniciados');
    await fetchAll();
  }, [user, fetchAll]);

  return (
    <FinanceContext.Provider value={{
      data, loading,
      addTransaction, updateTransaction, deleteTransaction,
      addPayable, updatePayable, deletePayable, markPayablePaid,
      addReceivable, updateReceivable, deleteReceivable, markReceivableReceived,
      addAccount, updateAccount, deleteAccount, transferBetweenAccounts,
      addBudget, updateBudget, deleteBudget,
      addCategory, updateCategory, deleteCategory,
      getCategoryName, getAccountName, getCategoryColor,
      resetAllData,
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
