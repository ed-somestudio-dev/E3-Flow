import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FinanceData, FinancialAccount, Transaction, Payable, Receivable, Budget, Category, hasAccountType, Contact } from './types';
import { usePixSettings } from './pix-settings-context';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { toast } from 'sonner';
import { saveSnapshot, loadSnapshot, enqueueMutation } from './offline-store';
import { assertOnline } from './online-guard';
import { syncOfflineMutations } from './sync-engine';
import { generateId } from './utils';



interface FinanceContextType {
  data: FinanceData;
  loading: boolean;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<Transaction | undefined>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addPayable: (p: Omit<Payable, 'id'>, installments?: number, isCredit?: boolean, recurrence?: { frequency: 'weekly' | 'monthly' | 'yearly'; occurrences: number }) => Promise<void>;
  updatePayable: (p: Payable) => Promise<void>;
  deletePayable: (id: string) => Promise<void>;
  deletePayableWithFuture: (id: string) => Promise<number>;
  markPayablePaid: (id: string, accountId?: string) => Promise<void>;
  markPayablePaidPartial: (id: string, accountId: string, paidAmount: number) => Promise<void>;
  addReceivable: (r: Omit<Receivable, 'id'>, installments?: number, recurrence?: { frequency: 'weekly' | 'monthly' | 'yearly'; occurrences: number }) => Promise<Receivable | undefined>;
  updateReceivable: (r: Receivable) => Promise<void>;
  deleteReceivable: (id: string) => Promise<void>;
  markReceivableReceived: (id: string, accountId?: string, customDate?: string) => Promise<void>;
  markReceivableReceivedPartial: (id: string, accountId: string, receivedAmount: number) => Promise<void>;
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
  addContact: (c: Omit<Contact, 'id'>) => Promise<Contact | null>;
  updateContact: (c: Contact) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  importContacts: (list: Omit<Contact, 'id'>[]) => Promise<number>;
  getCategoryName: (id: string) => string;
  getAccountName: (id: string) => string;
  getCategoryColor: (id: string) => string;
  resetAllData: () => Promise<void>;
  exportBackup: () => void;
  importBackup: (file: File) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

const emptyData: FinanceData = {
  accounts: [], categories: [], transactions: [], payables: [], receivables: [], budgets: [], contacts: [],
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
    creditUsed: row.credit_used ? Number(row.credit_used) : undefined,
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
    notes: row.notes ?? undefined, purchaseDate: row.purchase_date ?? undefined,
    recurring: row.recurring ?? undefined,
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
    recurring: row.recurring ?? false,
    recurrenceFrequency: row.recurrence_frequency ?? undefined,
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
  };
}

function mapCategory(row: any): Category {
  return { id: row.id, name: row.name, type: row.type, icon: row.icon, color: row.color };
}

function mapBudget(row: any): Budget {
  return { id: row.id, categoryId: row.category_id, amount: Number(row.amount), month: row.month };
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user, tenantUserId } = useAuth();
  const effectiveUserId = tenantUserId || user?.id;
  const { settings: pixSettings, refresh: refreshPix, save: savePix, uploadStampFromBase64 } = usePixSettings();
  const [data, setData] = useState<FinanceData>({ ...emptyData, contacts: [] });
  const [loading, setLoading] = useState(true);
  
  type AccountAdjustment = {
    balanceDelta: number;
    creditLimitDelta: number;
  };

  const fetchAll = useCallback(async () => {
    if (!user) { setData(emptyData); setLoading(false); return; }

    // Se estiver offline ou for visitante, restaura o último snapshot e encerra.
    if ((typeof navigator !== 'undefined' && !navigator.onLine) || effectiveUserId.startsWith('guest_')) {
      const snap = await loadSnapshot(effectiveUserId);
      if (snap) {
        setData(snap.data);
        if (!effectiveUserId.startsWith('guest_')) {
          toast.info('Modo offline: exibindo dados salvos no dispositivo');
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [cats, accs, txs, pays, recs, buds, conts] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', effectiveUserId),
        supabase.from('financial_accounts').select('*').eq('user_id', effectiveUserId),
        supabase.from('transactions').select('*').eq('user_id', effectiveUserId).order('date', { ascending: false }),
        supabase.from('payables').select('*').eq('user_id', effectiveUserId).order('due_date'),
        supabase.from('receivables').select('*').eq('user_id', effectiveUserId).order('due_date'),
        supabase.from('budgets').select('*').eq('user_id', effectiveUserId),
        supabase.from('contacts').select('*').eq('user_id', effectiveUserId).order('name'),
      ]);

      let categories = (cats.data || []).map(mapCategory);

      // Seed default categories for new users
      if (categories.length === 0) {
        const inserts = defaultCategories.map(c => ({ ...c, user_id: effectiveUserId }));
        const { data: inserted } = await supabase.from('categories').insert(inserts).select();
        categories = (inserted || []).map(mapCategory);
      }

      // Deduplicate categories (same name + type): keep the first, reassign references
      const seen = new Map<string, string>(); // "name|type" -> kept id
      const idMap = new Map<string, string>(); // duplicate id -> kept id
      const toDelete: string[] = [];
      for (const cat of categories) {
        const key = `${cat.name.trim().toLowerCase()}|${cat.type}`;
        if (seen.has(key)) {
          idMap.set(cat.id, seen.get(key)!);
          toDelete.push(cat.id);
        } else {
          seen.set(key, cat.id);
        }
      }
      if (toDelete.length > 0) {
        // Reassign references in payables, receivables, transactions, budgets
        for (const [oldId, newId] of idMap.entries()) {
          await Promise.all([
            supabase.from('payables').update({ category_id: newId }).eq('category_id', oldId).eq('user_id', effectiveUserId),
            supabase.from('receivables').update({ category_id: newId }).eq('category_id', oldId).eq('user_id', effectiveUserId),
            supabase.from('transactions').update({ category_id: newId }).eq('category_id', oldId).eq('user_id', effectiveUserId),
            supabase.from('budgets').update({ category_id: newId }).eq('category_id', oldId).eq('user_id', effectiveUserId),
          ]);
        }
        // Delete duplicate categories
        await supabase.from('categories').delete().in('id', toDelete);
        categories = categories.filter(c => !toDelete.includes(c.id));
        // Re-map category IDs in local data
        const remapCatId = (id: string) => idMap.get(id) || id;
        // We'll re-fetch to get clean data
        const [txs2, pays2, recs2, buds2] = await Promise.all([
          supabase.from('transactions').select('*').eq('user_id', effectiveUserId).order('date', { ascending: false }),
          supabase.from('payables').select('*').eq('user_id', effectiveUserId).order('due_date'),
          supabase.from('receivables').select('*').eq('user_id', effectiveUserId).order('due_date'),
          supabase.from('budgets').select('*').eq('user_id', effectiveUserId),
        ]);
        setData({
          categories,
          accounts: (accs.data || []).map(mapAccount),
          transactions: (txs2.data || []).map(mapTransaction),
          payables: (pays2.data || []).map(mapPayable),
          receivables: (recs2.data || []).map(mapReceivable),
          budgets: (buds2.data || []).map(mapBudget),
          contacts: (conts.data || []).map(row => ({
            id: row.id, name: row.name, phone: row.phone ?? undefined,
            email: row.email ?? undefined, document: row.document ?? undefined,
            notes: row.notes ?? undefined
          })),
        });
        setLoading(false);
        return;
      }

      const fresh: FinanceData = {
        categories,
        accounts: (accs.data || []).map(mapAccount),
        transactions: (txs.data || []).map(mapTransaction),
        payables: (pays.data || []).map(mapPayable),
        receivables: (recs.data || []).map(mapReceivable),
        budgets: (buds.data || []).map(mapBudget),
        contacts: (conts.data || []).map(row => ({
          id: row.id, name: row.name, phone: row.phone ?? undefined,
          email: row.email ?? undefined, document: row.document ?? undefined,
          notes: row.notes ?? undefined
        })),
      };
      setData(fresh);
      // Salva snapshot para acesso offline
      saveSnapshot(effectiveUserId, fresh).catch(() => {/* noop */ });
    } catch (err) {
      console.error('Failed to fetch data:', err);
      // Sem internet ou servidor caiu — tenta restaurar snapshot offline
      const snap = await loadSnapshot(effectiveUserId);
      if (snap) {
        setData(snap.data);
        toast.info('Sem conexão: usando dados salvos no dispositivo');
      } else {
        toast.error('Erro ao carregar dados');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Centralized sync and fetch flow
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const runSyncAndFetch = async () => {
      // Timeout de segurança: se em 5s não carregar, libera a tela
      const timer = setTimeout(() => {
        if (isMounted) {
          console.warn('[FinanceProvider] Timeout de segurança atingido. Liberando tela.');
          setLoading(false);
        }
      }, 5000);

      try {
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine && !effectiveUserId.startsWith('guest_');
        if (isOnline) {
          console.log('[FinanceProvider] Online: Sincronizando...');
          await syncOfflineMutations(effectiveUserId).catch(e => console.error('Sync failed:', e));
        } else {
          console.log('[FinanceProvider] Offline ou Visitante: Carregando snapshot...');
        }
        
        await fetchAll();
      } catch (e) {
        console.error('[FinanceProvider] Erro crítico na inicialização:', e);
      } finally {
        if (isMounted) {
          clearTimeout(timer);
          setLoading(false);
        }
      }
    };

    runSyncAndFetch();

    const handleOnline = () => {
      console.log('[FinanceProvider] Conexão restaurada.');
      runSyncAndFetch();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [user, fetchAll]);

  const queueTransactionAccountAdjustment = useCallback((
    adjustments: Record<string, AccountAdjustment>,
    transaction: Pick<Transaction, 'accountId' | 'type' | 'amount' | 'isCredit'>,
    direction: 1 | -1,
  ) => {
    const account = data.accounts.find(a => a.id === transaction.accountId);
    if (!account) return;

    const current = adjustments[account.id] || { balanceDelta: 0, creditLimitDelta: 0 };

    // Credit purchases don't affect balance — usage is tracked via invoices (payables)
    if (transaction.isCredit && account.type.includes('credit_card')) {
      // No balance or credit_limit change; invoice handles tracking
    } else {
      const signedAmount = transaction.type === 'income' ? transaction.amount : -transaction.amount;
      current.balanceDelta += signedAmount * direction;
    }

    adjustments[account.id] = current;
  }, [data.accounts]);

  const persistAccountAdjustments = useCallback(async (adjustments: Record<string, AccountAdjustment>) => {
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const updates = [];
    const localAccountUpdates: FinancialAccount[] = [];

    for (const [accountId, adjustment] of Object.entries(adjustments)) {
      const account = data.accounts.find(a => a.id === accountId);
      if (!account) continue;

      const payload: any = {};
      if (adjustment.balanceDelta !== 0) payload.balance = account.balance + adjustment.balanceDelta;
      
      if (Object.keys(payload).length === 0) continue;

      if (isOnline) {
        updates.push(supabase.from('financial_accounts').update(payload).eq('id', accountId));
      } else if (user) {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'UPDATE',
          payload: { table: 'financial_accounts', data: payload, match: { id: accountId } }
        });
        localAccountUpdates.push({ ...account, ...payload });
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    if (localAccountUpdates.length > 0) {
      setData(prev => {
        const fresh = {
          ...prev,
          accounts: prev.accounts.map(a => {
            const up = localAccountUpdates.find(u => u.id === a.id);
            return up ? up : a;
          })
        };
        if (user) saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }
  }, [data.accounts, user]);

  const adjustCreditCardInvoice = useCallback(async (acc: FinancialAccount, amountDelta: number, txDate: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const closeDay = acc.billingCloseDay || 1;
    const dueDay = acc.dueDay || 10;
    const d = new Date(txDate + 'T12:00:00');
    // Before close day: current month; after close day: next month
    let invoiceMonth = d.getMonth() + 1; // 1-based
    let invoiceYear = d.getFullYear();
    if (d.getDate() >= closeDay) {
      invoiceMonth += 1;
      if (invoiceMonth > 12) { invoiceMonth = 1; invoiceYear++; }
    }
    const invoiceKey = `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
    // If close day >= due day, due date falls in the next month
    let dueMonth = invoiceMonth;
    let dueYr = invoiceYear;
    if (closeDay >= dueDay) {
      dueMonth += 1;
      if (dueMonth > 12) { dueMonth = 1; dueYr++; }
    }
    const dueDate = `${dueYr}-${String(dueMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    const description = `Fatura ${acc.name} - ${String(invoiceMonth).padStart(2, '0')}/${invoiceYear}`;

    let existing: any = null;
    if (isOnline) {
      const { data: remote } = await supabase.from('payables')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('supplier', `cartao:${acc.id}`)
        .eq('due_date', dueDate)
        .maybeSingle();
      existing = remote;
    } else {
      existing = data.payables.find(p => 
        p.supplier === `cartao:${acc.id}` && 
        p.dueDate === dueDate && 
        p.status !== 'paid'
      );
    }

    if (existing) {
      const nextAmount = Number(existing.amount) + amountDelta;

      if (nextAmount <= 0.009) {
        if (isOnline) {
          await supabase.from('payables').delete().eq('id', existing.id);
        } else {
          await enqueueMutation({
            userId: effectiveUserId,
            type: 'DELETE',
            payload: { table: 'payables', match: { id: existing.id } }
          });
          setData(prev => {
            const fresh = { ...prev, payables: prev.payables.filter(p => p.id !== existing.id) };
            saveSnapshot(effectiveUserId, fresh).catch(() => {});
            return fresh;
          });
        }
        return;
      }

      const payload = { amount: nextAmount, description };
      if (isOnline) {
        await supabase.from('payables').update(payload).eq('id', existing.id);
      } else {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'UPDATE',
          payload: { table: 'payables', data: payload, match: { id: existing.id } }
        });
        setData(prev => {
          const fresh = { ...prev, payables: prev.payables.map(p => p.id === existing.id ? { ...p, ...payload } : p) };
          saveSnapshot(effectiveUserId, fresh).catch(() => {});
          return fresh;
        });
      }
      return;
    }

    if (amountDelta > 0) {
      const cat = data.categories.find(c => c.type === 'expense');
      if (!cat) return;
      const id = generateId();
      const payload = {
        id,
        user_id: effectiveUserId, description, supplier: `cartao:${acc.id}`,
        category_id: cat.id, account_id: acc.id,
        amount: amountDelta, due_date: dueDate, status: 'pending',
      };
      if (isOnline) {
        await supabase.from('payables').insert(payload);
      } else {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'INSERT',
          payload: { table: 'payables', data: payload }
        });
        const newPayable = mapPayable(payload);
        setData(prev => {
          const fresh = { ...prev, payables: [...prev.payables, newPayable] };
          saveSnapshot(effectiveUserId, fresh).catch(() => {});
          return fresh;
        });
      }
    }
  }, [user, data.categories, data.payables]);

  // --- Transactions ---
  const addTransaction = useCallback(async (tx: Omit<Transaction, 'id'>) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const id = generateId();
    const payload = {
      id,
      user_id: effectiveUserId, 
      type: tx.type, 
      description: tx.description,
      category_id: tx.categoryId, 
      amount: Number(tx.amount) || 0, 
      date: tx.date,
      account_id: tx.accountId, 
      notes: tx.notes || null,
      is_credit: tx.isCredit || false,
    };

    if (isOnline) {
      const { error } = await supabase.from('transactions').insert(payload as any);
      if (error) { toast.error('Erro ao criar transação'); return; }
    } else {
      await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'transactions', data: payload } });
      const newTx = mapTransaction(payload);
      setData(prev => {
        const fresh = { ...prev, transactions: [newTx, ...prev.transactions] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    const acc = data.accounts.find(a => a.id === tx.accountId);
    const adjustments: Record<string, AccountAdjustment> = {};
    queueTransactionAccountAdjustment(adjustments, tx, 1);

    await Promise.all([
      persistAccountAdjustments(adjustments),
      tx.isCredit && acc?.type?.includes('credit_card')
        ? adjustCreditCardInvoice(acc, tx.amount, tx.date)
        : Promise.resolve(),
    ]);

    if (isOnline) {
      await fetchAll();
    } else {
      toast.success('Transação salva offline');
    }
    return mapTransaction(payload);
  }, [user, data.accounts, fetchAll, persistAccountAdjustments, queueTransactionAccountAdjustment, adjustCreditCardInvoice]);


  const updateTransaction = useCallback(async (tx: Transaction) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const old = data.transactions.find(t => t.id === tx.id);
    
    const payload = {
      type: tx.type, 
      description: tx.description, 
      category_id: tx.categoryId,
      amount: Number(tx.amount) || 0, 
      date: tx.date, 
      account_id: tx.accountId, 
      notes: tx.notes || null,
      is_credit: tx.isCredit || false,
    };

    if (isOnline) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', tx.id);
      if (error) { toast.error('Erro ao atualizar transação'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'transactions', data: payload, match: { id: tx.id } }
      });
      setData(prev => {
        const fresh = {
          ...prev,
          transactions: prev.transactions.map(t => t.id === tx.id ? tx : t)
        };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    const adjustments: Record<string, AccountAdjustment> = {};
    if (old) queueTransactionAccountAdjustment(adjustments, old, -1);
    queueTransactionAccountAdjustment(adjustments, tx, 1);

    const oldAccount = old ? data.accounts.find(a => a.id === old.accountId) : undefined;
    const newAccount = data.accounts.find(a => a.id === tx.accountId);

    await Promise.all([
      persistAccountAdjustments(adjustments),
      (async () => {
        if (old?.isCredit && oldAccount?.type?.includes('credit_card')) {
          await adjustCreditCardInvoice(oldAccount, -old.amount, old.date);
        }
        if (tx.isCredit && newAccount?.type?.includes('credit_card')) {
          await adjustCreditCardInvoice(newAccount, tx.amount, tx.date);
        }
      })(),
    ]);

    if (isOnline) {
      await fetchAll();
    } else {
      toast.success('Alteração salva offline');
    }
  }, [user, data.transactions, data.accounts, fetchAll, persistAccountAdjustments, queueTransactionAccountAdjustment, adjustCreditCardInvoice]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const tx = data.transactions.find(t => t.id === id);

    if (isOnline) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) { toast.error('Erro ao excluir transação'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'DELETE',
        payload: { table: 'transactions', match: { id } }
      });
      setData(prev => {
        const fresh = {
          ...prev,
          transactions: prev.transactions.filter(t => t.id !== id)
        };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    if (tx) {
      const adjustments: Record<string, AccountAdjustment> = {};
      queueTransactionAccountAdjustment(adjustments, tx, -1);

      const acc = data.accounts.find(a => a.id === tx.accountId);
      await Promise.all([
        persistAccountAdjustments(adjustments),
        tx.isCredit && acc?.type?.includes('credit_card')
          ? adjustCreditCardInvoice(acc, -tx.amount, tx.date)
          : Promise.resolve(),
      ]);
    }

    if (isOnline) {
      await fetchAll();
    } else {
      toast.success('Exclusão salva offline');
    }
  }, [user, data.transactions, data.accounts, fetchAll, persistAccountAdjustments, queueTransactionAccountAdjustment, adjustCreditCardInvoice]);

  // --- Payables ---
  const addPayable = useCallback(async (p: Omit<Payable, 'id'>, installments?: number, isCredit?: boolean, recurrence?: { frequency: 'weekly' | 'monthly' | 'yearly'; occurrences: number }) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');

    // Recurring expansion (independent of installments) — generates N concrete records
    if (recurrence && recurrence.occurrences > 1) {
      const acc = p.accountId ? data.accounts.find(a => a.id === p.accountId) : undefined;
      const isCC = isCredit && acc?.type?.includes('credit_card');
      const closeDay = acc?.billingCloseDay || 1;
      const dDay = acc?.dueDay || 10;
      const baseDate = new Date(p.dueDate + 'T12:00:00');
      const basePurchase = (p as any).purchaseDate ? new Date((p as any).purchaseDate + 'T12:00:00') : null;

      for (let i = 0; i < recurrence.occurrences; i++) {
        let dueStr: string;
        let purchaseStr: string | null = null;

        if (isCC && basePurchase) {
          const vp = new Date(basePurchase);
          if (recurrence.frequency === 'weekly') vp.setDate(vp.getDate() + 7 * i);
          else if (recurrence.frequency === 'monthly') vp.setMonth(vp.getMonth() + i);
          else vp.setFullYear(vp.getFullYear() + i);
          purchaseStr = `${vp.getFullYear()}-${String(vp.getMonth() + 1).padStart(2, '0')}-${String(vp.getDate()).padStart(2, '0')}`;

          let dueMonth = vp.getMonth();
          let dueYear = vp.getFullYear();
          if (vp.getDate() >= closeDay) {
            dueMonth += 1;
            if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
          }
          if (closeDay >= dDay) {
            dueMonth += 1;
            if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
          }
          const lastDay = new Date(dueYear, dueMonth + 1, 0).getDate();
          const finalDay = Math.min(dDay, lastDay);
          dueStr = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
        } else {
          const d = new Date(baseDate);
          if (recurrence.frequency === 'weekly') d.setDate(d.getDate() + 7 * i);
          else if (recurrence.frequency === 'monthly') d.setMonth(d.getMonth() + i);
          else d.setFullYear(d.getFullYear() + i);
          dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const desc = `${p.description} (${i + 1}/${recurrence.occurrences})`;
        const supplier = isCC && acc ? `cartao:${acc.id}` : p.supplier;

        const payload = {
          user_id: effectiveUserId, description: desc, supplier,
          category_id: p.categoryId, account_id: p.accountId || null,
          amount: p.amount, due_date: dueStr, status: 'pending',
          notes: p.notes || null,
          recurring: true,
          recurrence_frequency: recurrence.frequency,
          purchase_date: purchaseStr,
        };

        if (isOnline) {
          await supabase.from('payables').insert(payload);
        } else {
          await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'payables', data: payload } });
          const newPayable = mapPayable({ id: generateId(), ...payload });
          setData(prev => {
            const fresh = { ...prev, payables: [...prev.payables, newPayable] };
            saveSnapshot(effectiveUserId, fresh).catch(() => { });
            return fresh;
          });
        }
      }
      if (isOnline) await fetchAll();
      if (!isOnline) toast.success('Salvo offline. Será sincronizado depois.');
      return;
    }

    if (installments && installments > 1) {
      const installmentAmount = Math.round((p.amount / installments) * 100) / 100;
      const acc = p.accountId ? data.accounts.find(a => a.id === p.accountId) : undefined;
      const closeDay = acc?.billingCloseDay || 1;
      const dDay = acc?.dueDay || 10;

      for (let i = 0; i < installments; i++) {
        let dueStr: string;

        if (acc?.type?.includes('credit_card') && (p as any).purchaseDate) {
          // Calculate due date based on billing cycle for each installment
          const purchase = new Date((p as any).purchaseDate + 'T12:00:00');
          // Add i months to purchase date to get the "virtual" purchase date for this installment
          const virtualPurchase = new Date(purchase);
          virtualPurchase.setMonth(virtualPurchase.getMonth() + i);

          // Before close day: current month's invoice; after: next month's
          let dueMonth = virtualPurchase.getMonth(); // 0-based
          let dueYear = virtualPurchase.getFullYear();
          if (virtualPurchase.getDate() >= closeDay) {
            dueMonth += 1;
            if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
          }
          // If close day >= due day, due date falls in the next month
          if (closeDay >= dDay) {
            dueMonth += 1;
            if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
          }
          const lastDay = new Date(dueYear, dueMonth + 1, 0).getDate();
          const finalDay = Math.min(dDay, lastDay);
          dueStr = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
        } else {
          const baseDate = new Date(p.dueDate + 'T12:00:00');
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const desc = `${p.description} (${i + 1}/${installments})`;

        const id = generateId();
        let payload;
        if (acc?.type?.includes('credit_card')) {
          payload = {
            id,
            user_id: effectiveUserId, description: desc, supplier: `cartao:${acc.id}`,
            category_id: p.categoryId, account_id: p.accountId || null,
            amount: installmentAmount, due_date: dueStr, status: 'pending',
            notes: p.notes || null, purchase_date: (p as any).purchaseDate || null,
          };
        } else {
          payload = {
            id,
            user_id: effectiveUserId, description: desc, supplier: p.supplier,
            category_id: p.categoryId, account_id: p.accountId || null,
            amount: installmentAmount, due_date: dueStr, status: 'pending',
            notes: p.notes || null,
          };
        }

        if (isOnline) {
          await supabase.from('payables').insert(payload);
        } else {
          await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'payables', data: payload } });
          const newPayable = mapPayable(payload);
          setData(prev => {
            const fresh = { ...prev, payables: [...prev.payables, newPayable] };
            saveSnapshot(effectiveUserId, fresh).catch(() => { });
            return fresh;
          });
        }
      }
      if (isOnline) await fetchAll();
      if (!isOnline) toast.success('Salvo offline. Será sincronizado depois.');
      return;
    }

    // If it's a credit purchase (single, no installments), store as individual purchase
    if (isCredit && p.accountId) {
      const acc = data.accounts.find(a => a.id === p.accountId);
      if (acc?.type?.includes('credit_card')) {
        const id = generateId();
        const payload = {
          id,
          user_id: effectiveUserId, description: p.description, supplier: `cartao:${acc.id}`,
          category_id: p.categoryId, account_id: p.accountId || null,
          amount: p.amount, due_date: p.dueDate, status: 'pending',
          notes: p.notes || null, purchase_date: (p as any).purchaseDate || null,
        };
        if (isOnline) {
          await supabase.from('payables').insert(payload);
          await fetchAll();
        } else {
          await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'payables', data: payload } });
          const newPayable = mapPayable(payload);
          setData(prev => {
            const fresh = { ...prev, payables: [...prev.payables, newPayable] };
            saveSnapshot(effectiveUserId, fresh).catch(() => { });
            return fresh;
          });
          toast.success('Salvo offline. Será sincronizado depois.');
        }
        return;
      }
    }

    const id = generateId();
    const payload = {
      id,
      user_id: effectiveUserId, 
      description: p.description, 
      supplier: p.supplier,
      category_id: p.categoryId, 
      account_id: p.accountId || null,
      amount: Number(p.amount) || 0, 
      due_date: p.dueDate, 
      status: p.status,
      notes: p.notes || null, 
      recurring: p.recurring || false,
      recurrence_frequency: p.recurrenceFrequency || null,
      recurrence_end_date: p.recurrenceEndDate || null,
    };

    if (isOnline) {
      const { error } = await supabase.from('payables').insert(payload);
      if (error) {
        if (error.message?.includes('Failed to fetch')) {
          // Fallback para offline
          await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'payables', data: payload } });
          const newPayable = mapPayable(payload);
          setData(prev => {
            const fresh = { ...prev, payables: [...prev.payables, newPayable] };
            saveSnapshot(effectiveUserId, fresh).catch(() => { });
            return fresh;
          });
          toast.success('Salvo offline. Será sincronizado depois.');
          return;
        }
        console.error('addPayable error:', error);
        toast.error('Erro ao criar conta a pagar');
        return;
      }
      await fetchAll();
    } else {
      await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'payables', data: payload } });
      const newPayable = mapPayable(payload);
      setData(prev => {
        const fresh = { ...prev, payables: [...prev.payables, newPayable] };
        saveSnapshot(effectiveUserId, fresh).catch(() => { });
        return fresh;
      });
      toast.success('Salvo offline. Será sincronizado depois.');
    }
  }, [user, data, fetchAll, adjustCreditCardInvoice]);

  const updatePayable = useCallback(async (p: Payable) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const payload = {
      description: p.description, 
      supplier: p.supplier,
      category_id: p.categoryId, 
      account_id: p.accountId || null,
      amount: Number(p.amount) || 0, 
      due_date: p.dueDate, 
      status: p.status,
      notes: p.notes || null, 
      recurring: p.recurring || false,
      recurrence_frequency: p.recurrenceFrequency || null,
      recurrence_end_date: p.recurrenceEndDate || null,
    };

    if (isOnline) {
      const { error } = await supabase.from('payables').update(payload).eq('id', p.id).eq('user_id', effectiveUserId);
      if (error) { console.error('updatePayable error:', error); toast.error('Erro ao atualizar conta a pagar'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'payables', data: payload, match: { id: p.id } }
      });
      setData(prev => {
        const fresh = { ...prev, payables: prev.payables.map(x => x.id === p.id ? p : x) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Alteração salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const deletePayable = useCallback(async (id: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');

    if (isOnline) {
      const { error } = await supabase.from('payables').delete().eq('id', id).eq('user_id', effectiveUserId);
      if (error) { console.error('deletePayable error:', error); toast.error('Erro ao excluir conta a pagar'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'DELETE',
        payload: { table: 'payables', match: { id } }
      });
      setData(prev => {
        const fresh = { ...prev, payables: prev.payables.filter(p => p.id !== id) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Exclusão salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  // Exclui esta conta + todas as futuras vinculadas (mesma série recorrente).
  // Vínculo detectado por: mesmo supplier, mesma category, recurring=true, e
  // descrição base equivalente (ignorando o sufixo "(i/N)" gerado na expansão).
  // Considera "futuras" as contas com due_date >= due_date da atual.
  const deletePayableWithFuture = useCallback(async (id: string): Promise<number> => {
    if (!user) return 0;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const target = data.payables.find(p => p.id === id);
    if (!target) return 0;
    const stripSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase();
    const baseDesc = stripSuffix(target.description);
    const ids = data.payables
      .filter(p =>
        p.recurring &&
        p.supplier === target.supplier &&
        p.categoryId === target.categoryId &&
        p.dueDate >= target.dueDate &&
        stripSuffix(p.description) === baseDesc &&
        p.status !== 'paid'
      )
      .map(p => p.id);
    const allIds = Array.from(new Set([id, ...ids]));

    if (isOnline) {
      const { error } = await supabase.from('payables').delete().in('id', allIds).eq('user_id', effectiveUserId);
      if (error) { console.error('deletePayableWithFuture error:', error); toast.error('Erro ao excluir contas vinculadas'); return 0; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'DELETE',
        payload: { table: 'payables', matchIn: { column: 'id', values: allIds } }
      });
      setData(prev => {
        const fresh = { ...prev, payables: prev.payables.filter(p => !allIds.includes(p.id)) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success(`${allIds.length} contas excluídas offline`);
    }

    if (isOnline) await fetchAll();
    return allIds.length;
  }, [user, data.payables, fetchAll]);

  const markPayablePaid = useCallback(async (id: string, accountId?: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const payable = data.payables.find(x => x.id === id);
    const targetAccountId = accountId || payable?.accountId;
    const today = new Date().toISOString().split('T')[0];

    if (isOnline) {
      const { error } = await supabase.from('payables').update({
        status: 'paid', payment_date: today, account_id: targetAccountId || null,
      }).eq('id', id).eq('user_id', effectiveUserId);
      if (error) { console.error('markPayablePaid error:', error); toast.error('Erro ao marcar como pago'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'payables', data: { status: 'paid', payment_date: today, account_id: targetAccountId || null }, match: { id } }
      });
      setData(prev => {
        const fresh = { ...prev, payables: prev.payables.map(p => p.id === id ? { ...p, status: 'paid' as const, paymentDate: today, accountId: targetAccountId } : p) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    if (payable && targetAccountId) {
      const acc = data.accounts.find(a => a.id === targetAccountId);
      if (acc) {
        const debitsMainBalance = hasAccountType(acc, 'checking') || hasAccountType(acc, 'cash');
        if (debitsMainBalance) {
          if (isOnline) {
            const { error: balErr } = await supabase.rpc('decrement_account_balance' as any, { p_account_id: targetAccountId, p_amount: payable.amount });
            if (balErr) console.error('decrement balance error:', balErr);
          } else {
            await enqueueMutation({
              userId: effectiveUserId,
              type: 'RPC',
              payload: { rpc: 'decrement_account_balance', args: { p_account_id: targetAccountId, p_amount: payable.amount } }
            });
            setData(prev => {
              const fresh = { ...prev, accounts: prev.accounts.map(a => a.id === targetAccountId ? { ...a, balance: a.balance - payable.amount } : a) };
              saveSnapshot(effectiveUserId, fresh).catch(() => {});
              return fresh;
            });
          }
        }
      }

      // Criar transação de despesa automaticamente
      const txId = generateId();
      const txPayload = {
        id: txId,
        user_id: effectiveUserId,
        type: 'expense',
        description: payable.description,
        category_id: payable.categoryId,
        amount: payable.amount,
        date: today,
        account_id: targetAccountId,
        notes: `Pagamento: ${payable.supplier || ''}`.trim(),
      };

      if (isOnline) {
        await supabase.from('transactions').insert(txPayload);
      } else {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'INSERT',
          payload: { table: 'transactions', data: txPayload }
        });
        const newTx = mapTransaction(txPayload);
        setData(prev => {
          const fresh = { ...prev, transactions: [newTx, ...prev.transactions] };
          saveSnapshot(effectiveUserId, fresh).catch(() => {});
          return fresh;
        });
      }
    }

    if (isOnline) {
      await fetchAll();
    } else {
      toast.success('Pagamento registrado offline');
    }
  }, [user, data, fetchAll]);

  const markPayablePaidPartial = useCallback(async (id: string, accountId: string, paidAmount: number) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const payable = data.payables.find(x => x.id === id);
    if (!payable) { toast.error('Conta não encontrada'); return; }
    if (paidAmount <= 0) { toast.error('Valor pago deve ser maior que zero'); return; }
    if (paidAmount >= payable.amount) {
      // Pagamento integral — delega para o fluxo padrão
      await markPayablePaid(id, accountId);
      return;
    }
    const remaining = Math.round((payable.amount - paidAmount) * 100) / 100;
    const today = new Date().toISOString().split('T')[0];

    // 1) Marca o registro original como pago com o valor parcial
    const updatePayload = {
      status: 'paid' as const,
      payment_date: today,
      account_id: accountId,
      amount: paidAmount,
      notes: `${payable.notes ? payable.notes + ' | ' : ''}Pagamento parcial de ${payable.amount.toFixed(2)}`,
    };

    if (isOnline) {
      const { error: updErr } = await supabase.from('payables').update(updatePayload).eq('id', id).eq('user_id', effectiveUserId);
      if (updErr) { console.error('partial payable update error:', updErr); toast.error('Erro ao registrar pagamento parcial'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'payables', data: updatePayload, match: { id } }
      });
      setData(prev => {
        const fresh = { ...prev, payables: prev.payables.map(p => p.id === id ? { ...p, ...updatePayload, paymentDate: today, accountId } : p) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    // 2) Cria novo registro pendente com o valor restante (mantém os demais dados)
    const insertPayload = {
      user_id: effectiveUserId,
      description: `${payable.description} (Saldo restante)`,
      supplier: payable.supplier,
      category_id: payable.categoryId,
      account_id: payable.accountId || null,
      amount: remaining,
      due_date: payable.dueDate,
      status: 'pending',
      notes: `${payable.notes ? payable.notes + ' | ' : ''}Saldo restante de pagamento parcial (original: ${payable.amount.toFixed(2)}, pago: ${paidAmount.toFixed(2)})`,
      purchase_date: payable.purchaseDate || null,
    };

    if (isOnline) {
      const { error: insErr } = await supabase.from('payables').insert(insertPayload);
      if (insErr) { console.error('partial payable insert error:', insErr); toast.error('Erro ao criar saldo restante'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'INSERT',
        payload: { table: 'payables', data: insertPayload }
      });
      const newPayable = mapPayable({ id: generateId(), ...insertPayload });
      setData(prev => {
        const fresh = { ...prev, payables: [...prev.payables, newPayable] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    // 3) Ajusta saldo da conta de débito e cria transação
    const acc = data.accounts.find(a => a.id === accountId);
    if (acc) {
      const debitsMainBalance = hasAccountType(acc, 'checking') || hasAccountType(acc, 'cash');
      if (debitsMainBalance) {
        if (isOnline) {
          const { error: balErr } = await supabase.rpc('decrement_account_balance' as any, { p_account_id: accountId, p_amount: paidAmount });
          if (balErr) console.error('decrement balance error:', balErr);
        } else {
          await enqueueMutation({
            userId: effectiveUserId,
            type: 'RPC',
            payload: { rpc: 'decrement_account_balance', args: { p_account_id: accountId, p_amount: paidAmount } }
          });
          setData(prev => {
            const fresh = { ...prev, accounts: prev.accounts.map(a => a.id === accountId ? { ...a, balance: a.balance - paidAmount } : a) };
            saveSnapshot(effectiveUserId, fresh).catch(() => {});
            return fresh;
          });
        }
      }
    }

    const txId = generateId();
    const txPayload = {
      id: txId,
      user_id: effectiveUserId,
      type: 'expense',
      description: payable.description,
      category_id: payable.categoryId,
      amount: paidAmount,
      date: today,
      account_id: accountId,
      notes: `Pagamento parcial: ${payable.supplier || ''}`.trim(),
    };

    if (isOnline) {
      await supabase.from('transactions').insert(txPayload);
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'INSERT',
        payload: { table: 'transactions', data: txPayload }
      });
      const newTx = mapTransaction(txPayload);
      setData(prev => {
        const fresh = { ...prev, transactions: [newTx, ...prev.transactions] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    toast.success(`Pagamento parcial registrado. Saldo restante: ${remaining.toFixed(2)}`);
    if (isOnline) await fetchAll();
  }, [user, data, fetchAll, markPayablePaid]);

  // --- Receivables ---
  const addReceivable = useCallback(async (r: Omit<Receivable, 'id'>, installments?: number, recurrence?: { frequency: 'weekly' | 'monthly' | 'yearly'; occurrences: number }) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');

    // Recurring expansion — generates N concrete records visible in calculations and reports
    if (recurrence && recurrence.occurrences > 1) {
      const baseDate = new Date(r.dueDate + 'T12:00:00');
      let firstRec: Receivable | undefined;
      for (let i = 0; i < recurrence.occurrences; i++) {
        const d = new Date(baseDate);
        if (recurrence.frequency === 'weekly') d.setDate(d.getDate() + 7 * i);
        else if (recurrence.frequency === 'monthly') d.setMonth(d.getMonth() + i);
        else d.setFullYear(d.getFullYear() + i);
        const dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const desc = `${r.description} (${i + 1}/${recurrence.occurrences})`;

        const id = generateId();
        const payload = {
          id,
          user_id: effectiveUserId, client_name: r.clientName, description: desc,
          category_id: r.categoryId, account_id: r.accountId || null,
          amount: r.amount, due_date: dueStr, status: 'pending',
          notes: r.notes || null,
          recurring: true,
          recurrence_frequency: recurrence.frequency,
        };

        if (isOnline) {
          await supabase.from('receivables').insert(payload);
        } else {
          await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'receivables', data: payload } });
          const newReceivable = mapReceivable(payload);
          setData(prev => {
            const fresh = { ...prev, receivables: [...prev.receivables, newReceivable] };
            saveSnapshot(effectiveUserId, fresh).catch(() => { });
            return fresh;
          });
        }
        if (i === 0) firstRec = mapReceivable(payload);
      }
      if (isOnline) await fetchAll();
      else toast.success('Salvo offline. Será sincronizado depois.');
      return firstRec;
    }

    if (installments && installments > 1) {
      const installmentAmount = Math.round((r.amount / installments) * 100) / 100;
      const baseDate = new Date(r.dueDate + 'T12:00:00');
      let firstRec: Receivable | undefined;

      for (let i = 0; i < installments; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const dueStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const desc = `${r.description} (${i + 1}/${installments})`;

        const id = generateId();
        const payload = {
          id,
          user_id: effectiveUserId, client_name: r.clientName, description: desc,
          category_id: r.categoryId, account_id: r.accountId || null,
          amount: installmentAmount, due_date: dueStr, status: 'pending',
          notes: r.notes || null,
        };

        if (isOnline) {
          await supabase.from('receivables').insert(payload);
        } else {
          await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'receivables', data: payload } });
          const newReceivable = mapReceivable(payload);
          setData(prev => {
            const fresh = { ...prev, receivables: [...prev.receivables, newReceivable] };
            saveSnapshot(effectiveUserId, fresh).catch(() => { });
            return fresh;
          });
        }
        if (i === 0) firstRec = mapReceivable(payload);
      }
      if (isOnline) await fetchAll();
      else toast.success('Salvo offline. Será sincronizado depois.');
      return firstRec;
    }

    const id = generateId();
    const payload = {
      id,
      user_id: effectiveUserId, 
      client_name: r.clientName, 
      description: r.description,
      category_id: r.categoryId, 
      account_id: r.accountId || null,
      amount: Number(r.amount) || 0, 
      due_date: r.dueDate, 
      status: r.status,
      notes: r.notes || null,
      recurring: r.recurring || false,
      recurrence_frequency: r.recurrenceFrequency || null,
      recurrence_end_date: r.recurrenceEndDate || null,
    };

    if (isOnline) {
      const { error } = await supabase.from('receivables').insert(payload);
      if (error) {
        if (error.message?.includes('Failed to fetch')) {
          await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'receivables', data: payload } });
          const newReceivable = mapReceivable(payload);
          setData(prev => {
            const fresh = { ...prev, receivables: [...prev.receivables, newReceivable] };
            saveSnapshot(effectiveUserId, fresh).catch(() => { });
            return fresh;
          });
          toast.success('Salvo offline. Será sincronizado depois.');
          return;
        }
        console.error('addReceivable error:', error);
        toast.error('Erro ao criar conta a receber');
        return;
      }
      await fetchAll();
    } else {
      await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'receivables', data: payload } });
      const newReceivable = mapReceivable(payload);
      setData(prev => {
        const fresh = { ...prev, receivables: [...prev.receivables, newReceivable] };
        saveSnapshot(effectiveUserId, fresh).catch(() => { });
        return fresh;
      });
      toast.success('Salvo offline. Será sincronizado depois.');
    }
    return mapReceivable(payload);
  }, [user, fetchAll]);

  const updateReceivable = useCallback(async (r: Receivable) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const payload = {
      client_name: r.clientName, 
      description: r.description,
      category_id: r.categoryId, 
      account_id: r.accountId || null,
      amount: Number(r.amount) || 0, 
      due_date: r.dueDate, 
      status: r.status,
      notes: r.notes || null,
      recurring: r.recurring || false,
      recurrence_frequency: r.recurrenceFrequency || null,
      recurrence_end_date: r.recurrenceEndDate || null,
    };

    if (isOnline) {
      const { error } = await supabase.from('receivables').update(payload).eq('id', r.id).eq('user_id', effectiveUserId);
      if (error) { console.error('updateReceivable error:', error); toast.error('Erro ao atualizar conta a receber'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'receivables', data: payload, match: { id: r.id } }
      });
      setData(prev => {
        const fresh = { ...prev, receivables: prev.receivables.map(x => x.id === r.id ? r : x) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Alteração salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const deleteReceivable = useCallback(async (id: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');

    if (isOnline) {
      const { error } = await supabase.from('receivables').delete().eq('id', id).eq('user_id', effectiveUserId);
      if (error) { console.error('deleteReceivable error:', error); toast.error('Erro ao excluir conta a receber'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'DELETE',
        payload: { table: 'receivables', match: { id } }
      });
      setData(prev => {
        const fresh = { ...prev, receivables: prev.receivables.filter(r => r.id !== id) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Exclusão salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const markReceivableReceived = useCallback(async (id: string, accountId?: string, customDate?: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const receivable = data.receivables.find(x => x.id === id);
    if (!receivable || receivable.status === 'received') return;

    const targetAccountId = accountId || receivable?.accountId;
    const paymentDate = customDate || new Date().toISOString().split('T')[0];

    if (isOnline) {
      const { error } = await supabase.from('receivables').update({
        status: 'received', payment_date: paymentDate, account_id: targetAccountId || null,
      }).eq('id', id).eq('user_id', effectiveUserId);
      if (error) { console.error('markReceivableReceived error:', error); toast.error('Erro ao marcar como recebido'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'receivables', data: { status: 'received', payment_date: paymentDate, account_id: targetAccountId || null }, match: { id } }
      });
    }

    // Update local state immediately (optimistic update) to prevent redundant calls
    setData(prev => {
      const fresh = { 
        ...prev, 
        receivables: prev.receivables.map(r => r.id === id ? { ...r, status: 'received' as const, paymentDate: paymentDate, accountId: targetAccountId } : r) 
      };
      saveSnapshot(effectiveUserId, fresh).catch(() => {});
      return fresh;
    });

    if (receivable && targetAccountId) {
      const acc = data.accounts.find(a => a.id === targetAccountId);
      if (acc) {
        if (isOnline) {
          const { error: balErr } = await supabase.rpc('increment_account_balance' as any, { p_account_id: targetAccountId, p_amount: receivable.amount });
          if (balErr) console.error('increment balance error:', balErr);
        } else {
          await enqueueMutation({
            userId: effectiveUserId,
            type: 'RPC',
            payload: { rpc: 'increment_account_balance', args: { p_account_id: targetAccountId, p_amount: receivable.amount } }
          });
          setData(prev => {
            const fresh = { ...prev, accounts: prev.accounts.map(a => a.id === targetAccountId ? { ...a, balance: a.balance + receivable.amount } : a) };
            saveSnapshot(effectiveUserId, fresh).catch(() => {});
            return fresh;
          });
        }
      }

      // Criar transação de receita automaticamente
      const txId = generateId();
      const txPayload = {
        id: txId,
        user_id: effectiveUserId,
        type: 'income',
        description: receivable.description,
        category_id: receivable.categoryId,
        amount: receivable.amount,
        date: paymentDate,
        account_id: targetAccountId,
        notes: `Recebimento: ${receivable.clientName || ''}`.trim(),
      };

      if (isOnline) {
        await supabase.from('transactions').insert(txPayload);
      } else {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'INSERT',
          payload: { table: 'transactions', data: txPayload }
        });
        const newTx = mapTransaction(txPayload);
        setData(prev => {
          const fresh = { ...prev, transactions: [newTx, ...prev.transactions] };
          saveSnapshot(effectiveUserId, fresh).catch(() => {});
          return fresh;
        });
      }
    }

    if (isOnline) await fetchAll();
    else toast.success('Recebimento registrado offline');

    // Emite evento para o módulo de vendas sincronizar
    window.dispatchEvent(new CustomEvent('receivable_paid', { 
      detail: { 
        id: id,
        description: receivable?.description 
      } 
    }));
  }, [user, data, fetchAll]);

  const markReceivableReceivedPartial = useCallback(async (id: string, accountId: string, receivedAmount: number) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const receivable = data.receivables.find(x => x.id === id);
    if (!receivable || receivable.status === 'received') return;
    if (receivedAmount <= 0) { toast.error('Valor recebido deve ser maior que zero'); return; }
    if (receivedAmount >= receivable.amount) {
      await markReceivableReceived(id, accountId);
      return;
    }
    const remaining = Math.round((receivable.amount - receivedAmount) * 100) / 100;
    const today = new Date().toISOString().split('T')[0];

    // 1) Marca o registro original como recebido com o valor parcial
    const updatePayload = {
      status: 'received' as const,
      payment_date: today,
      account_id: accountId,
      amount: receivedAmount,
      notes: `${receivable.notes ? receivable.notes + ' | ' : ''}Recebimento parcial de ${receivable.amount.toFixed(2)}`,
    };

    if (isOnline) {
      const { error: updErr } = await supabase.from('receivables').update(updatePayload).eq('id', id).eq('user_id', effectiveUserId);
      if (updErr) { console.error('partial receivable update error:', updErr); toast.error('Erro ao registrar recebimento parcial'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'receivables', data: updatePayload, match: { id } }
      });
      setData(prev => {
        const fresh = { ...prev, receivables: prev.receivables.map(r => r.id === id ? { ...r, ...updatePayload, paymentDate: today, accountId } : r) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    // 2) Cria novo registro pendente com o valor restante
    const newReceivableId = generateId();
    const insertPayload = {
      id: newReceivableId,
      user_id: effectiveUserId,
      client_name: receivable.clientName,
      description: `${receivable.description} (Saldo restante)`,
      category_id: receivable.categoryId,
      account_id: receivable.accountId || null,
      amount: remaining,
      due_date: receivable.dueDate,
      status: 'pending',
      notes: `${receivable.notes ? receivable.notes + ' | ' : ''}Saldo restante de recebimento parcial (original: ${receivable.amount.toFixed(2)}, recebido: ${receivedAmount.toFixed(2)})`,
    };

    if (isOnline) {
      const { error: insErr } = await supabase.from('receivables').insert(insertPayload);
      if (insErr) { console.error('partial receivable insert error:', insErr); toast.error('Erro ao criar saldo restante'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'INSERT',
        payload: { table: 'receivables', data: insertPayload }
      });
      const newReceivable = mapReceivable(insertPayload);
      setData(prev => {
        const fresh = { ...prev, receivables: [...prev.receivables, newReceivable] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    // 3) Credita conta e cria transação
    if (isOnline) {
      const { error: balErr } = await supabase.rpc('increment_account_balance' as any, { p_account_id: accountId, p_amount: receivedAmount });
      if (balErr) console.error('increment balance error:', balErr);
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'RPC',
        payload: { rpc: 'increment_account_balance', args: { p_account_id: accountId, p_amount: receivedAmount } }
      });
      setData(prev => {
        const fresh = { ...prev, accounts: prev.accounts.map(a => a.id === accountId ? { ...a, balance: a.balance + receivedAmount } : a) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    const txId = generateId();
    const txPayload = {
      id: txId,
      user_id: effectiveUserId,
      type: 'income',
      description: receivable.description,
      category_id: receivable.categoryId,
      amount: receivedAmount,
      date: today,
      account_id: accountId,
      notes: `Recebimento parcial: ${receivable.clientName || ''}`.trim(),
    };

    if (isOnline) {
      await supabase.from('transactions').insert(txPayload);
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'INSERT',
        payload: { table: 'transactions', data: txPayload }
      });
      const newTx = mapTransaction(txPayload);
      setData(prev => {
        const fresh = { ...prev, transactions: [newTx, ...prev.transactions] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    }

    toast.success(`Recebimento parcial registrado. Saldo restante: ${remaining.toFixed(2)}`);
    if (isOnline) await fetchAll();

    // Emite evento de recebimento parcial (para atualizar o link na venda)
    window.dispatchEvent(new CustomEvent('receivable_partial_received', { 
      detail: { originalId: id, newId: newReceivableId } 
    }));
  }, [user, data, fetchAll, markReceivableReceived]);

  // --- Accounts ---
  const addAccount = useCallback(async (a: Omit<FinancialAccount, 'id'>) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const id = generateId();
    
    // Defensive payload construction
    const payload = {
      id,
      user_id: effectiveUserId,
      name: (a.name || '').trim(),
      type: a.type || 'checking',
      balance: isNaN(Number(a.balance)) ? 0 : Number(a.balance),
      savings_balance: isNaN(Number(a.savingsBalance)) ? 0 : Number(a.savingsBalance),
      color: a.color || '#888888',
      credit_limit: (a.creditLimit !== undefined && a.creditLimit !== null && !isNaN(Number(a.creditLimit))) ? Number(a.creditLimit) : null,
      credit_used: isNaN(Number(a.creditUsed)) ? 0 : Number(a.creditUsed),
      billing_close_day: (a.billingCloseDay !== undefined && a.billingCloseDay !== null && !isNaN(Number(a.billingCloseDay))) ? Number(a.billingCloseDay) : null,
      due_day: (a.dueDay !== undefined && a.dueDay !== null && !isNaN(Number(a.dueDay))) ? Number(a.dueDay) : null,
    };

    if (isOnline) {
      const { error } = await supabase.from('financial_accounts').insert(payload);
      if (error) { 
        console.error('addAccount error detailed:', error); 
        toast.error('Erro ao criar conta: ' + (error.message || 'Verifique os dados')); 
        return; 
      }
      const newAcc = mapAccount(payload);
      setData(prev => {
        const fresh = { ...prev, accounts: [...prev.accounts, newAcc] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    } else {
      await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'financial_accounts', data: payload } });
      const newAcc = mapAccount(payload);
      setData(prev => {
        const fresh = { ...prev, accounts: [...prev.accounts, newAcc] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Conta criada offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const updateAccount = useCallback(async (a: FinancialAccount) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    
    const payload = {
      name: (a.name || '').trim(),
      type: a.type || 'checking',
      balance: isNaN(Number(a.balance)) ? 0 : Number(a.balance),
      savings_balance: isNaN(Number(a.savingsBalance)) ? 0 : Number(a.savingsBalance),
      color: a.color || '#888888',
      credit_limit: (a.creditLimit !== undefined && a.creditLimit !== null && !isNaN(Number(a.creditLimit))) ? Number(a.creditLimit) : null,
      credit_used: isNaN(Number(a.creditUsed)) ? 0 : Number(a.creditUsed),
      billing_close_day: (a.billingCloseDay !== undefined && a.billingCloseDay !== null && !isNaN(Number(a.billingCloseDay))) ? Number(a.billingCloseDay) : null,
      due_day: (a.dueDay !== undefined && a.dueDay !== null && !isNaN(Number(a.dueDay))) ? Number(a.dueDay) : null,
    };

    if (isOnline) {
      const { error } = await supabase.from('financial_accounts').update(payload).eq('id', a.id).eq('user_id', effectiveUserId);
      if (error) { 
        console.error('updateAccount error detailed:', error); 
        toast.error('Erro ao atualizar conta: ' + (error.message || 'Verifique os dados')); 
        return; 
      }
      setData(prev => {
        const fresh = { ...prev, accounts: prev.accounts.map(x => x.id === a.id ? a : x) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'financial_accounts', data: payload, match: { id: a.id } }
      });
      setData(prev => {
        const fresh = { ...prev, accounts: prev.accounts.map(x => x.id === a.id ? a : x) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Alteração salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const deleteAccount = useCallback(async (id: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');

    if (isOnline) {
      const { error } = await supabase.from('financial_accounts').delete().eq('id', id).eq('user_id', effectiveUserId);
      if (error) { console.error('deleteAccount error:', error); toast.error('Não é possível excluir conta com transações vinculadas'); return; }
      setData(prev => {
        const fresh = { ...prev, accounts: prev.accounts.filter(a => a.id !== id) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'DELETE',
        payload: { table: 'financial_accounts', match: { id } }
      });
      setData(prev => {
        const fresh = { ...prev, accounts: prev.accounts.filter(a => a.id !== id) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Exclusão salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const transferBetweenAccounts = useCallback(async (fromId: string, toId: string, amount: number) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const fromAcc = data.accounts.find(a => a.id === fromId);
    const toAcc = data.accounts.find(a => a.id === toId);
    if (!fromAcc || !toAcc) return;

    if (isOnline) {
      await Promise.all([
        supabase.from('financial_accounts').update({ balance: fromAcc.balance - amount }).eq('id', fromId),
        supabase.from('financial_accounts').update({ balance: toAcc.balance + amount }).eq('id', toId),
      ]);
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'financial_accounts', data: { balance: fromAcc.balance - amount }, match: { id: fromId } }
      });
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'financial_accounts', data: { balance: toAcc.balance + amount }, match: { id: toId } }
      });
      setData(prev => {
        const fresh = {
          ...prev,
          accounts: prev.accounts.map(a => {
            if (a.id === fromId) return { ...a, balance: a.balance - amount };
            if (a.id === toId) return { ...a, balance: a.balance + amount };
            return a;
          })
        };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Transferência salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, data, fetchAll]);

  // --- Budgets ---
  const addBudget = useCallback(async (b: Omit<Budget, 'id'>) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const id = generateId();
    const payload = {
      id,
      user_id: effectiveUserId, category_id: b.categoryId, amount: b.amount, month: b.month,
    };

    if (isOnline) {
      const { error } = await supabase.from('budgets').insert(payload);
      if (error) { console.error('addBudget error:', error); toast.error('Erro ao criar orçamento'); return; }
    } else {
      await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'budgets', data: payload } });
      const newBudget = mapBudget(payload);
      setData(prev => {
        const fresh = { ...prev, budgets: [...prev.budgets, newBudget] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Orçamento criado offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const updateBudget = useCallback(async (b: Budget) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const payload = { category_id: b.categoryId, amount: b.amount, month: b.month };

    if (isOnline) {
      const { error } = await supabase.from('budgets').update(payload).eq('id', b.id).eq('user_id', effectiveUserId);
      if (error) { console.error('updateBudget error:', error); toast.error('Erro ao atualizar orçamento'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'budgets', data: payload, match: { id: b.id } }
      });
      setData(prev => {
        const fresh = { ...prev, budgets: prev.budgets.map(x => x.id === b.id ? b : x) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Alteração salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const deleteBudget = useCallback(async (id: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');

    if (isOnline) {
      const { error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', effectiveUserId);
      if (error) { console.error('deleteBudget error:', error); toast.error('Erro ao excluir orçamento'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'DELETE',
        payload: { table: 'budgets', match: { id } }
      });
      setData(prev => {
        const fresh = { ...prev, budgets: prev.budgets.filter(b => b.id !== id) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Exclusão salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  // --- Categories ---
  const addCategory = useCallback(async (c: Omit<Category, 'id'>) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const id = generateId();
    const payload = {
      id,
      user_id: effectiveUserId, name: c.name, type: c.type, icon: c.icon, color: c.color,
    };

    if (isOnline) {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) { toast.error('Erro ao criar categoria'); return; }
    } else {
      await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'categories', data: payload } });
      const newCat = mapCategory(payload);
      setData(prev => {
        const fresh = { ...prev, categories: [...prev.categories, newCat] };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Categoria criada offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const updateCategory = useCallback(async (c: Category) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const payload = {
      name: c.name, type: c.type, icon: c.icon, color: c.color,
    };

    if (isOnline) {
      const { error } = await supabase.from('categories').update(payload).eq('id', c.id).eq('user_id', effectiveUserId);
      if (error) { toast.error('Erro ao atualizar categoria'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'categories', data: payload, match: { id: c.id } }
      });
      setData(prev => {
        const fresh = { ...prev, categories: prev.categories.map(x => x.id === c.id ? c : x) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Alteração salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');

    if (isOnline) {
      const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', effectiveUserId);
      if (error) { toast.error('Não é possível excluir categoria com dados vinculados'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'DELETE',
        payload: { table: 'categories', match: { id } }
      });
      setData(prev => {
        const fresh = { ...prev, categories: prev.categories.filter(c => c.id !== id) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Exclusão salva offline');
    }

    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const addContact = useCallback(async (c: Omit<Contact, 'id'>) => {
    if (!user) return null;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const id = generateId();
    const payload = {
      id,
      user_id: effectiveUserId,
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      document: c.document || null,
      notes: c.notes || null,
    };

    if (isOnline) {
      const { data: remote, error } = await supabase.from('contacts').insert(payload).select().single();
      if (error) { toast.error('Erro ao salvar contato'); return null; }
      const created = { 
        id: remote.id, name: remote.name, phone: remote.phone ?? undefined,
        email: remote.email ?? undefined, document: remote.document ?? undefined,
        notes: remote.notes ?? undefined
      };
      setData(prev => {
        const fresh = { ...prev, contacts: [...prev.contacts, created].sort((a, b) => a.name.localeCompare(b.name)) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      return created;
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'INSERT',
        payload: { table: 'contacts', data: payload }
      });
      const created = { id, ...c };
      setData(prev => {
        const fresh = { ...prev, contacts: [...prev.contacts, created].sort((a, b) => a.name.localeCompare(b.name)) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success('Contato salvo offline');
      return created;
    }
  }, [user]);

  const updateContact = useCallback(async (c: Contact) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const payload = {
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      document: c.document || null,
      notes: c.notes || null,
    };

    if (isOnline) {
      const { error } = await supabase.from('contacts').update(payload).eq('id', c.id).eq('user_id', effectiveUserId);
      if (error) { toast.error('Erro ao atualizar contato'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'UPDATE',
        payload: { table: 'contacts', data: payload, match: { id: c.id } }
      });
      toast.success('Alteração salva offline');
    }
    setData(prev => {
      const fresh = { ...prev, contacts: prev.contacts.map(x => x.id === c.id ? c : x).sort((a, b) => a.name.localeCompare(b.name)) };
      saveSnapshot(effectiveUserId, fresh).catch(() => {});
      return fresh;
    });
    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const deleteContact = useCallback(async (id: string) => {
    if (!user) return;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');

    if (isOnline) {
      const { error } = await supabase.from('contacts').delete().eq('id', id).eq('user_id', effectiveUserId);
      if (error) { toast.error('Erro ao excluir contato'); return; }
    } else {
      await enqueueMutation({
        userId: effectiveUserId,
        type: 'DELETE',
        payload: { table: 'contacts', match: { id } }
      });
      toast.success('Exclusão salva offline');
    }
    setData(prev => {
      const fresh = { ...prev, contacts: prev.contacts.filter(x => x.id !== id) };
      saveSnapshot(effectiveUserId, fresh).catch(() => {});
      return fresh;
    });
    if (isOnline) await fetchAll();
  }, [user, fetchAll]);

  const importContacts = useCallback(async (list: Omit<Contact, 'id'>[]) => {
    if (!user || list.length === 0) return 0;
    const isOnline = assertOnline() && !user?.id?.startsWith('guest_');
    const existingNames = new Set(data.contacts.map(c => c.name.toLowerCase()));
    const fresh = list.filter(c => c.name && !existingNames.has(c.name.toLowerCase()));
    if (fresh.length === 0) return 0;

    const rows = fresh.map(c => ({
      user_id: effectiveUserId,
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      document: c.document || null,
      notes: c.notes || null,
    }));

    if (isOnline) {
      const { data: remoteData, error } = await supabase.from('contacts').insert(rows).select();
      if (error) { toast.error('Erro ao importar contatos'); return 0; }
      const inserted = (remoteData || []).map(row => ({
        id: row.id, name: row.name, phone: row.phone ?? undefined,
        email: row.email ?? undefined, document: row.document ?? undefined,
        notes: row.notes ?? undefined
      }));
      setData(prev => {
        const fresh = { ...prev, contacts: [...prev.contacts, ...inserted].sort((a, b) => a.name.localeCompare(b.name)) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      return inserted.length;
    } else {
      const insertions = rows.map(async (row) => {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'INSERT',
          payload: { table: 'contacts', data: row }
        });
      });
      await Promise.all(insertions);
      
      const newContacts = fresh.map(c => ({ id: generateId(), ...c }));
      setData(prev => {
        const fresh = { ...prev, contacts: [...prev.contacts, ...newContacts].sort((a, b) => a.name.localeCompare(b.name)) };
        saveSnapshot(effectiveUserId, fresh).catch(() => {});
        return fresh;
      });
      toast.success(`${fresh.length} contatos salvos offline`);
      return fresh.length;
    }
  }, [user, data.contacts]);

  const getCategoryName = useCallback((id: string) => data.categories.find(c => c.id === id)?.name || 'Desconhecido', [data.categories]);
  const getAccountName = useCallback((id: string) => data.accounts.find(a => a.id === id)?.name || 'Desconhecido', [data.accounts]);
  const getCategoryColor = useCallback((id: string) => data.categories.find(c => c.id === id)?.color || '#888', [data.categories]);

  const resetAllData = useCallback(async () => {
    if (!assertOnline()) {
      toast.error('Você precisa estar online para reiniciar todos os dados (limpeza remota)');
      return;
    }
    if (!user) return;
    
    toast.info('Limpando dados remotos e locais...');

    try {
      // 1. Delete in order to respect foreign keys
      await supabase.from('transactions').delete().eq('user_id', effectiveUserId);
      await supabase.from('payables').delete().eq('user_id', effectiveUserId);
      await supabase.from('receivables').delete().eq('user_id', effectiveUserId);
      await supabase.from('budgets').delete().eq('user_id', effectiveUserId);
      await supabase.from('sales').delete().eq('user_id', effectiveUserId); // sale_items cascades
      await supabase.from('products').delete().eq('user_id', effectiveUserId);
      await supabase.from('financial_accounts').delete().eq('user_id', effectiveUserId);
      await supabase.from('categories').delete().eq('user_id', effectiveUserId);
      await supabase.from('contacts').delete().eq('user_id', effectiveUserId);
      await supabase.from('user_settings').delete().eq('user_id', effectiveUserId);
      
      // 2. Storage cleanup (receipt stamps)
      try {
        const { data: files, error: listErr } = await supabase.storage.from('receipt-stamps').list(effectiveUserId);
        if (!listErr && files && files.length > 0) {
          const paths = files.map(f => `${effectiveUserId}/${f.name}`);
          await supabase.storage.from('receipt-stamps').remove(paths);
        }
      } catch (e) { console.error('Storage cleanup failed:', e); }

      // 3. Local Cleanup (IndexedDB)
      const { clearSnapshot, clearMutationsQueue } = await import('./offline-store');
      await clearSnapshot(effectiveUserId);
      await clearMutationsQueue(effectiveUserId);

      // 4. Refresh contexts
      await refreshPix();
      window.dispatchEvent(new CustomEvent('reset_sales')); // Notify SalesProvider
      
      await fetchAll();
      toast.success('Todos os dados foram reiniciados com sucesso');
    } catch (err: any) {
      console.error('Reset failed:', err);
      toast.error('Erro ao reiniciar dados: ' + err.message);
    }
  }, [user, fetchAll, refreshPix]);

  const exportBackup = useCallback(async () => {
    toast.info('Preparando backup, por favor aguarde...');
    let stampBase64 = null;
    if (pixSettings.receiptStampUrl) {
      try {
        const response = await fetch(pixSettings.receiptStampUrl);
        const blob = await response.blob();
        stampBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Could not include stamp in backup:', e);
      }
    }

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
      pixSettings,
      stampBase64,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxopro-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exportado com sucesso');
  }, [data, pixSettings]);

  const importBackup = useCallback(async (file: File) => {
    if (!assertOnline()) return;
    if (!user) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.data || !backup.version) {
        toast.error('Arquivo de backup inválido');
        return;
      }
      const bd = backup.data as FinanceData;

      // Clear existing data
      await supabase.from('budgets').delete().eq('user_id', effectiveUserId);
      await supabase.from('transactions').delete().eq('user_id', effectiveUserId);
      await supabase.from('payables').delete().eq('user_id', effectiveUserId);
      await supabase.from('receivables').delete().eq('user_id', effectiveUserId);
      await supabase.from('financial_accounts').delete().eq('user_id', effectiveUserId);
      await supabase.from('categories').delete().eq('user_id', effectiveUserId);
      await supabase.from('contacts').delete().eq('user_id', effectiveUserId);
      await supabase.from('user_settings').delete().eq('user_id', effectiveUserId);

      // Restore categories
      if (bd.categories.length > 0) {
        await supabase.from('categories').insert(bd.categories.map(c => ({
          id: c.id, name: c.name, type: c.type, icon: c.icon, color: c.color, user_id: effectiveUserId,
        })));
      }

      // Restore accounts
      if (bd.accounts.length > 0) {
        await supabase.from('financial_accounts').insert(bd.accounts.map(a => ({
          id: a.id, name: a.name, type: a.type, balance: a.balance,
          savings_balance: a.savingsBalance || 0, credit_limit: a.creditLimit ?? null,
          credit_used: a.creditUsed ?? 0, billing_close_day: a.billingCloseDay ?? null,
          due_day: a.dueDay ?? null, color: a.color, user_id: effectiveUserId,
        })));
      }

      // Restore transactions
      if (bd.transactions.length > 0) {
        await supabase.from('transactions').insert(bd.transactions.map(t => ({
          id: t.id, type: t.type, description: t.description, category_id: t.categoryId,
          amount: t.amount, date: t.date, account_id: t.accountId,
          notes: t.notes ?? null, is_credit: t.isCredit ?? false, user_id: effectiveUserId,
        })));
      }

      // Restore payables
      if (bd.payables.length > 0) {
        await supabase.from('payables').insert(bd.payables.map(p => ({
          id: p.id, description: p.description, supplier: p.supplier,
          category_id: p.categoryId, account_id: p.accountId ?? null,
          amount: p.amount, due_date: p.dueDate, payment_date: p.paymentDate ?? null,
          payment_method: p.paymentMethod ?? null, status: p.status === 'overdue' ? 'pending' : p.status,
          notes: p.notes ?? null, purchase_date: p.purchaseDate ?? null,
          recurring: p.recurring ?? false, recurrence_frequency: p.recurrenceFrequency ?? null,
          recurrence_end_date: p.recurrenceEndDate ?? null, user_id: effectiveUserId,
        })));
      }

      // Restore receivables
      if (bd.receivables.length > 0) {
        await supabase.from('receivables').insert(bd.receivables.map(r => ({
          id: r.id, client_name: r.clientName, description: r.description,
          category_id: r.categoryId, account_id: r.accountId ?? null,
          amount: r.amount, due_date: r.dueDate, payment_date: r.paymentDate ?? null,
          payment_method: r.paymentMethod ?? null, status: r.status === 'overdue' ? 'pending' : r.status,
          notes: r.notes ?? null, recurring: r.recurring ?? false,
          recurrence_frequency: r.recurrenceFrequency ?? null,
          recurrence_end_date: r.recurrenceEndDate ?? null, user_id: effectiveUserId,
        })));
      }

      // Restore budgets
      if (bd.budgets.length > 0) {
        await supabase.from('budgets').insert(bd.budgets.map(b => ({
          id: b.id, category_id: b.categoryId, amount: b.amount, month: b.month, user_id: effectiveUserId,
        })));
      }

      // Restore contacts
      if (bd.contacts && bd.contacts.length > 0) {
        await supabase.from('contacts').insert(bd.contacts.map(c => ({
          id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null,
          document: c.document ?? null, notes: c.notes ?? null, user_id: effectiveUserId,
        })));
      }

      // Restore settings if present
      if (backup.pixSettings) {
        const settingsToRestore = { ...backup.pixSettings };
        
        // If backup contains stamp image as Base64, upload it back to storage
        if (backup.stampBase64) {
          try {
            const newUrl = await uploadStampFromBase64(backup.stampBase64);
            settingsToRestore.receiptStampUrl = newUrl;
          } catch (e) {
            console.error('Failed to restore stamp image:', e);
          }
        }
        
        await savePix(settingsToRestore);
      }

      await refreshPix();
      await fetchAll();
      toast.success('Backup restaurado com sucesso');
    } catch (e) {
      console.error('Import error:', e);
      toast.error('Erro ao restaurar backup');
    }
  }, [user, fetchAll, refreshPix]);

  return (
    <FinanceContext.Provider value={{
      data, loading,
      addTransaction, updateTransaction, deleteTransaction,
      addPayable, updatePayable, deletePayable, deletePayableWithFuture, markPayablePaid, markPayablePaidPartial,
      addReceivable, updateReceivable, deleteReceivable, markReceivableReceived, markReceivableReceivedPartial,
      addAccount, updateAccount, deleteAccount, transferBetweenAccounts,
      addBudget, updateBudget, deleteBudget,
      addCategory, updateCategory, deleteCategory,
      addContact, updateContact, deleteContact, importContacts,
      getCategoryName, getAccountName, getCategoryColor,
      resetAllData, exportBackup, importBackup,
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

