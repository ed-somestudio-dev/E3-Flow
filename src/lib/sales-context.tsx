import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth-context';
import { toast } from 'sonner';
import { Product, Sale, SaleItem, SaleStatus } from './types';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

function mapProduct(row: any): Product {
  return {
    id: row.id, name: row.name,
    description: row.description ?? undefined,
    price: Number(row.price),
    stockQuantity: Number(row.stock_quantity),
    unit: row.unit || 'un',
    categoryId: row.category_id ?? undefined,
    active: row.active ?? true,
  };
}

function mapSaleItem(row: any): SaleItem {
  return {
    id: row.id, saleId: row.sale_id,
    productId: row.product_id ?? undefined,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
  };
}

function mapSale(row: any, items: SaleItem[] = []): Sale {
  return {
    id: row.id, clientName: row.client_name ?? undefined,
    status: row.status as SaleStatus, total: Number(row.total),
    paymentMethod: row.payment_method ?? undefined,
    notes: row.notes ?? undefined, saleDate: row.sale_date,
    receivableId: row.receivable_id ?? undefined,
    items, createdAt: row.created_at,
  };
}

export interface NewSaleItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface NewSalePayload {
  clientName?: string;
  status: SaleStatus;
  paymentMethod?: string;
  notes?: string;
  saleDate: string;
  items: NewSaleItem[];
}

interface SalesContextType {
  products: Product[];
  sales: Sale[];
  loadingProducts: boolean;
  loadingSales: boolean;
  addProduct: (p: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createSale: (payload: NewSalePayload, createReceivable?: boolean, categoryId?: string, accountId?: string) => Promise<Sale | null>;
  updateSaleStatus: (id: string, status: SaleStatus) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  refreshSales: () => Promise<void>;
  refreshProducts: () => Promise<void>;
}

const SalesContext = createContext<SalesContextType | null>(null);

export function SalesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);

  const refreshProducts = useCallback(async () => {
    if (!user) { setProducts([]); setLoadingProducts(false); return; }
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products').select('*').eq('user_id', user.id).order('name');
      if (error) throw error;
      setProducts((data || []).map(mapProduct));
    } catch (err) {
      console.error('[SalesContext] Failed to load products:', err);
    } finally { setLoadingProducts(false); }
  }, [user]);

  const refreshSales = useCallback(async () => {
    if (!user) { setSales([]); setLoadingSales(false); return; }
    setLoadingSales(true);
    try {
      const { data: salesData, error } = await supabase
        .from('sales').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!salesData || salesData.length === 0) { setSales([]); return; }

      const { data: itemsData } = await supabase
        .from('sale_items').select('*').in('sale_id', salesData.map(s => s.id));

      const itemsMap: Record<string, SaleItem[]> = {};
      for (const item of (itemsData || [])) {
        const m = mapSaleItem(item);
        if (!itemsMap[m.saleId]) itemsMap[m.saleId] = [];
        itemsMap[m.saleId].push(m);
      }
      setSales(salesData.map(s => mapSale(s, itemsMap[s.id] || [])));
    } catch (err) {
      console.error('[SalesContext] Failed to load sales:', err);
    } finally { setLoadingSales(false); }
  }, [user]);

  useEffect(() => {
    refreshProducts();
    refreshSales();
  }, [user, refreshProducts, refreshSales]);

  const addProduct = useCallback(async (p: Omit<Product, 'id'>) => {
    if (!user) return;
    const { error } = await supabase.from('products').insert({
      user_id: user.id, name: p.name,
      description: p.description || null, price: p.price,
      stock_quantity: p.stockQuantity, unit: p.unit,
      category_id: p.categoryId || null, active: p.active,
    });
    if (error) { toast.error('Erro ao criar produto: ' + error.message); return; }
    toast.success('Produto criado!');
    await refreshProducts();
  }, [user, refreshProducts]);

  const updateProduct = useCallback(async (p: Product) => {
    if (!user) return;
    const { error } = await supabase.from('products').update({
      name: p.name, description: p.description || null, price: p.price,
      stock_quantity: p.stockQuantity, unit: p.unit,
      category_id: p.categoryId || null, active: p.active,
      updated_at: new Date().toISOString(),
    }).eq('id', p.id);
    if (error) { toast.error('Erro ao atualizar produto: ' + error.message); return; }
    toast.success('Produto atualizado!');
    await refreshProducts();
  }, [user, refreshProducts]);

  const deleteProduct = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir produto: ' + error.message); return; }
    toast.success('Produto excluído!');
    await refreshProducts();
  }, [user, refreshProducts]);

  const createSale = useCallback(async (
    payload: NewSalePayload,
    createReceivable = false,
    categoryId?: string,
    accountId?: string,
  ): Promise<Sale | null> => {
    if (!user) return null;
    const total = payload.items.reduce((s, i) => s + i.total, 0);

    const { data: saleData, error: saleError } = await supabase
      .from('sales').insert({
        user_id: user.id, client_name: payload.clientName || null,
        status: payload.status, total,
        payment_method: payload.paymentMethod || null,
        notes: payload.notes || null, sale_date: payload.saleDate,
      }).select().single();

    if (saleError || !saleData) {
      toast.error('Erro ao registrar venda: ' + saleError?.message);
      return null;
    }

    // Insert items
    await supabase.from('sale_items').insert(
      payload.items.map(item => ({
        sale_id: saleData.id,
        product_id: item.productId || null,
        product_name: item.productName,
        quantity: item.quantity, unit_price: item.unitPrice, total: item.total,
      }))
    );

    // Decrease stock for completed sales
    if (payload.status === 'completed') {
      for (const item of payload.items) {
        if (item.productId) {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            await supabase.from('products').update({
              stock_quantity: Math.max(0, prod.stockQuantity - item.quantity),
              updated_at: new Date().toISOString(),
            }).eq('id', item.productId);
          }
        }
      }
    }

    // Create receivable if requested
    if (createReceivable && payload.clientName) {
      const { data: cats } = await supabase.from('categories')
        .select('id').eq('user_id', user.id).eq('type', 'income').limit(1);
      const catId = categoryId || cats?.[0]?.id;
      if (catId) {
        const recId = generateId();
        await supabase.from('receivables').insert({
          id: recId, user_id: user.id,
          client_name: payload.clientName,
          description: `Venda #${saleData.id.slice(0, 8).toUpperCase()}`,
          category_id: catId, account_id: accountId || null,
          amount: total, due_date: payload.saleDate,
          status: 'pending',
        });
        await supabase.from('sales').update({ receivable_id: recId }).eq('id', saleData.id);
      }
    }

    toast.success('Venda registrada!');
    await refreshSales();
    await refreshProducts();
    return mapSale(saleData, payload.items.map((item, i) => ({
      id: `tmp-${i}`, saleId: saleData.id,
      productId: item.productId, productName: item.productName,
      quantity: item.quantity, unitPrice: item.unitPrice, total: item.total,
    })));
  }, [user, products, refreshSales, refreshProducts]);

  const updateSaleStatus = useCallback(async (id: string, status: SaleStatus) => {
    if (!user) return;
    const sale = sales.find(s => s.id === id);

    // Restore stock if cancelling a completed sale
    if (sale && sale.status === 'completed' && status === 'cancelled') {
      for (const item of sale.items) {
        if (item.productId) {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            await supabase.from('products').update({
              stock_quantity: prod.stockQuantity + item.quantity,
              updated_at: new Date().toISOString(),
            }).eq('id', item.productId);
          }
        }
      }
    }

    // Decrease stock if completing a pending sale
    if (sale && sale.status === 'pending' && status === 'completed') {
      for (const item of sale.items) {
        if (item.productId) {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            await supabase.from('products').update({
              stock_quantity: Math.max(0, prod.stockQuantity - item.quantity),
              updated_at: new Date().toISOString(),
            }).eq('id', item.productId);
          }
        }
      }
    }

    const { error } = await supabase.from('sales').update({ status }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status: ' + error.message); return; }
    toast.success('Status atualizado!');
    await refreshSales();
    await refreshProducts();
  }, [user, sales, products, refreshSales, refreshProducts]);

  const deleteSale = useCallback(async (id: string) => {
    if (!user) return;
    const sale = sales.find(s => s.id === id);
    // Restore stock if deleting a completed sale
    if (sale && sale.status === 'completed') {
      for (const item of sale.items) {
        if (item.productId) {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            await supabase.from('products').update({
              stock_quantity: prod.stockQuantity + item.quantity,
              updated_at: new Date().toISOString(),
            }).eq('id', item.productId);
          }
        }
      }
    }
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir venda: ' + error.message); return; }
    toast.success('Venda excluída!');
    await refreshSales();
    await refreshProducts();
  }, [user, sales, products, refreshSales, refreshProducts]);

  return (
    <SalesContext.Provider value={{
      products, sales, loadingProducts, loadingSales,
      addProduct, updateProduct, deleteProduct,
      createSale, updateSaleStatus, deleteSale,
      refreshSales, refreshProducts,
    }}>
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error('useSales must be used within SalesProvider');
  return ctx;
}
