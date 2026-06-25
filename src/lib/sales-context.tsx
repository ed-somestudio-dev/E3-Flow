import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { useFinance } from "./finance-context";
import { toast } from "sonner";
import { Product, Sale, SaleItem, SaleStatus } from "./types";
import { assertOnline } from "./online-guard";
import { enqueueMutation, saveSnapshot, loadSnapshot, SALES_SNAPSHOT_STORE, SALES_LIST_SNAPSHOT_STORE } from "./offline-store";
import { generateId } from "./utils";

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    price: Number(row.unit_price ?? row.price),
    stockQuantity: Number(row.stock_quantity),
    unit: row.unit || "un",
    categoryId: row.category ?? row.category_id ?? undefined,
    active: row.active ?? true,
    imageUrl: row.image_url ?? undefined,
  };
}

function mapSaleItem(row: any): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id ?? undefined,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
  };
}

function mapSale(row: any, items: SaleItem[] = []): Sale {
  return {
    id: row.id,
    clientName: row.client_name ?? undefined,
    status: row.status as SaleStatus,
    total: Number(row.total),
    paymentMethod: row.payment_method ?? undefined,
    notes: row.notes ?? undefined,
    saleDate: row.sale_date,
    receivableId: row.receivable_id ?? undefined,
    trackingCode: row.tracking_code ?? undefined,
    carrier: row.carrier ?? undefined,
    shippingCost: row.shipping_cost ? Number(row.shipping_cost) : undefined,
    estimatedDelivery: row.estimated_delivery ?? undefined,
    requiresShipping: row.requires_shipping ?? false,
    items,
    createdAt: row.created_at,
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
  saleDate: string;
  dueDate?: string;
  status: SaleStatus;
  paymentMethod?: string;
  notes?: string;
  trackingCode?: string;
  carrier?: string;
  shippingCost?: number;
  estimatedDelivery?: string;
  requiresShipping?: boolean;
  items: NewSaleItem[];
}

interface SalesContextType {
  products: Product[];
  sales: Sale[];
  loadingProducts: boolean;
  loadingSales: boolean;
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createSale: (
    payload: NewSalePayload,
    createReceivable?: boolean,
    categoryId?: string,
    accountId?: string,
  ) => Promise<Sale | null>;
  updateSaleStatus: (id: string, status: SaleStatus) => Promise<void>;
  updateSaleShipping: (id: string, trackingInfo: { trackingCode?: string; carrier?: string; shippingCost?: number; estimatedDelivery?: string }) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  refreshSales: () => Promise<void>;
  refreshProducts: () => Promise<void>;
}

const SalesContext = createContext<SalesContextType | null>(null);

export function SalesProvider({ children }: { children: React.ReactNode }) {
  const { user, tenantUserId } = useAuth();
  const effectiveUserId = tenantUserId || user?.id;
  const finance = useFinance();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);

  const refreshProducts = useCallback(async () => {
    if (!user) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }
    setLoadingProducts(true);
    try {
      const isOnline = assertOnline() && !user.id.startsWith('guest_');
      if (isOnline) {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("user_id", effectiveUserId)
          .order("name");
        if (error) throw error;
        const mapped = (data || []).map(mapProduct);
        setProducts(mapped);
        saveSnapshot(effectiveUserId, mapped, SALES_SNAPSHOT_STORE).catch(() => {});
      } else {
        const snap = await loadSnapshot(effectiveUserId, SALES_SNAPSHOT_STORE);
        if (snap) setProducts(snap.data);
      }
    } catch (err) {
      console.error("[SalesContext] Failed to load products:", err);
      const snap = await loadSnapshot(effectiveUserId, SALES_SNAPSHOT_STORE);
      if (snap) setProducts(snap.data);
    } finally {
      setLoadingProducts(false);
    }
  }, [user]);

  const refreshSales = useCallback(async () => {
    if (!user) {
      setSales([]);
      setLoadingSales(false);
      return;
    }
    setLoadingSales(true);
    try {
      const isOnline = assertOnline() && !user.id.startsWith('guest_');
      if (isOnline) {
        const { data, error } = await supabase
          .from("sales")
          .select("*, items:sale_items(*)")
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const mapped = (data || []).map((row) =>
          mapSale(row, (row.items || []).map(mapSaleItem)),
        );
        setSales(mapped);
        saveSnapshot(effectiveUserId, mapped, SALES_LIST_SNAPSHOT_STORE).catch(() => {});
      } else {
        const snap = await loadSnapshot(effectiveUserId, SALES_LIST_SNAPSHOT_STORE);
        if (snap) setSales(snap.data);
      }
    } catch (err) {
      console.error("[SalesContext] Failed to load sales:", err);
      const snap = await loadSnapshot(effectiveUserId, SALES_LIST_SNAPSHOT_STORE);
      if (snap) setSales(snap.data);
    } finally {
      setLoadingSales(false);
    }
  }, [user]);

  useEffect(() => {
    refreshProducts();
    refreshSales();
  }, [user, refreshProducts, refreshSales]);

  const addProduct = useCallback(
    async (p: Omit<Product, "id">) => {
      if (!user) return;
      const isOnline = assertOnline() && !user.id.startsWith('guest_');
      const id = generateId();
      const payload = {
        id,
        user_id: effectiveUserId,
        name: p.name,
        description: p.description || null,
        price: p.price,
        stock_quantity: p.stockQuantity,
        category_id: p.categoryId || null,
        image_url: p.imageUrl || null,
      };

      const newProd = mapProduct(payload);
      setProducts(prev => {
        const next = [...prev, newProd].sort((a, b) => a.name.localeCompare(b.name));
        saveSnapshot(effectiveUserId, next, SALES_SNAPSHOT_STORE).catch(() => {});
        return next;
      });

      if (isOnline) {
        const { error } = await supabase.from("products").insert(payload);
        if (error) {
          if (error.message?.includes('Failed to fetch')) {
            await enqueueMutation({
              userId: effectiveUserId,
              type: 'INSERT',
              payload: { table: 'products', data: payload }
            });
            toast.success("Salvo offline (conexão instável)");
            return;
          }
          toast.error("Erro ao adicionar produto: " + error.message);
          await refreshProducts();
          return;
        }
      } else {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'INSERT',
          payload: { table: 'products', data: payload }
        });
      }
      toast.success("Produto adicionado!");
    },
    [user, refreshProducts],
  );

  const updateProduct = useCallback(
    async (p: Product) => {
      if (!user) return;
      const isOnline = assertOnline() && !user.id.startsWith('guest_');
      const payload = {
        name: p.name,
        description: p.description || null,
        price: p.price,
        stock_quantity: p.stockQuantity,
        category_id: p.categoryId || null,
        image_url: p.imageUrl || null,
        updated_at: new Date().toISOString(),
      };

      setProducts(prev => {
        const next = prev.map(x => x.id === p.id ? p : x);
        saveSnapshot(effectiveUserId, next, SALES_SNAPSHOT_STORE).catch(() => {});
        return next;
      });

      if (isOnline) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", p.id);
        if (error) {
          if (error.message?.includes('Failed to fetch')) {
            await enqueueMutation({
              userId: effectiveUserId,
              type: 'UPDATE',
              payload: { table: 'products', data: payload, match: { id: p.id } }
            });
            toast.success("Alteração salva offline (conexão instável)");
            return;
          }
          toast.error("Erro ao atualizar produto: " + error.message);
          await refreshProducts();
          return;
        }
      } else {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'UPDATE',
          payload: { table: 'products', data: payload, match: { id: p.id } }
        });
      }
      toast.success("Produto atualizado!");
    },
    [user, refreshProducts],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!user) return;
      const isOnline = assertOnline() && !user.id.startsWith('guest_');

      setProducts(prev => {
        const next = prev.filter(p => p.id !== id);
        saveSnapshot(effectiveUserId, next, SALES_SNAPSHOT_STORE).catch(() => {});
        return next;
      });

      if (isOnline) {
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) {
          if (error.message?.includes('Failed to fetch')) {
            await enqueueMutation({
              userId: effectiveUserId,
              type: 'DELETE',
              payload: { table: 'products', match: { id } }
            });
            toast.success("Exclusão salva offline (conexão instável)");
            return;
          }
          toast.error("Erro ao excluir produto: " + error.message);
          await refreshProducts();
          return;
        }
      } else {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'DELETE',
          payload: { table: 'products', match: { id } }
        });
      }

      toast.success("Produto excluído!");
    },
    [user, refreshProducts],
  );

  const createSale = useCallback(
    async (
      payload: NewSalePayload,
      createReceivable = false,
      categoryId?: string,
      accountId?: string,
    ): Promise<Sale | null> => {
      if (!user) return null;
      const isOnline = assertOnline() && !user.id.startsWith('guest_');
      const total = payload.items.reduce((s, i) => s + i.total, 0);
      const saleId = generateId();

      const salePayload = {
        id: saleId,
        user_id: effectiveUserId,
        client_name: payload.clientName || null,
        status: payload.status,
        total,
        payment_method: payload.paymentMethod || null,
        notes: payload.notes || null,
        sale_date: payload.saleDate,
        tracking_code: payload.trackingCode || null,
        carrier: payload.carrier || null,
        shipping_cost: payload.shippingCost || null,
        estimated_delivery: payload.estimatedDelivery || null,
        requires_shipping: payload.requiresShipping ?? false,
        created_at: new Date().toISOString(),
      };

      const itemsPayload = payload.items.map((item) => ({
        sale_id: saleId,
        product_id: item.productId || null,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
      }));

      const newSale = mapSale(
        salePayload,
        payload.items.map((item, i) => ({
          id: `tmp-${i}-${generateId()}`,
          saleId: saleId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      );

      setSales(prev => {
        const next = [newSale, ...prev];
        saveSnapshot(effectiveUserId, next, SALES_LIST_SNAPSHOT_STORE).catch(() => {});
        return next;
      });

      if (isOnline) {
        const { error: saleError } = await supabase.from("sales").insert(salePayload);
        if (saleError) {
          if (saleError.message?.includes('Failed to fetch')) {
            await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'sales', data: salePayload } });
            await enqueueMutation({ userId: effectiveUserId, type: 'INSERT', payload: { table: 'sale_items', data: itemsPayload } });
            toast.success("Venda salva offline (conexão instável)");
          } else {
            toast.error("Erro ao registrar venda: " + saleError.message);
            await refreshSales();
            return null;
          }
        } else {
          await supabase.from("sale_items" as any).insert(itemsPayload);
        }
      } else {
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'INSERT',
          payload: { table: 'sales', data: salePayload }
        });
        await enqueueMutation({
          userId: effectiveUserId,
          type: 'INSERT',
          payload: { table: 'sale_items', data: itemsPayload }
        });
      }

      // Deduct stock for both completed and pending sales (credit sales)
      if (payload.status === "completed" || payload.status === "pending") {
        for (const item of payload.items) {
          if (item.productId) {
            const prod = products.find((p) => p.id === item.productId);
            if (prod) {
              const nextStock = Math.max(0, prod.stockQuantity - item.quantity);
              
              if (nextStock === 0) {
                toast.warning(`O estoque de "${prod.name}" acabou!`);
              }

              const stockPayload = { stock_quantity: nextStock, updated_at: new Date().toISOString() };
              
              setProducts(prev => {
                const next = prev.map(p => p.id === item.productId ? { ...p, stockQuantity: nextStock } : p);
                saveSnapshot(effectiveUserId, next, SALES_SNAPSHOT_STORE).catch(() => {});
                return next;
              });

              if (isOnline) {
                const { error: stockErr } = await supabase.from("products").update(stockPayload).eq("id", item.productId);
                if (stockErr && stockErr.message?.includes('Failed to fetch')) {
                  await enqueueMutation({
                    userId: effectiveUserId,
                    type: 'UPDATE',
                    payload: { table: 'products', data: stockPayload, match: { id: item.productId } }
                  });
                }
              } else {
                await enqueueMutation({
                  userId: effectiveUserId,
                  type: 'UPDATE',
                  payload: { table: 'products', data: stockPayload, match: { id: item.productId } }
                });
              }
            }
          }
        }
      }

      let finalReceivableId = null;
      if (createReceivable) {
        const cats = finance.data.categories.filter((c) => c.type === "income");
        const catId = categoryId || cats?.[0]?.id;
        if (payload.status === "completed") {
          const targetAccountId = accountId || (finance.data.accounts.length > 0 ? finance.data.accounts[0].id : "");
          if (catId && targetAccountId) {
            const itemsSummary = payload.items.map(i => `${i.productName} (x${i.quantity})`).join(', ');
            await finance.addTransaction({
              type: "income",
              description: `Venda: ${itemsSummary}`,
              categoryId: catId,
              accountId: targetAccountId,
              amount: total,
              date: payload.saleDate,
              notes: payload.notes,
              isCredit: false,
            });
          }
        } else {
          const itemsSummary = payload.items.map(i => `${i.productName} (x${i.quantity})`).join(', ');
          const rec = await finance.addReceivable({
            clientName: payload.clientName || "Consumidor Final",
            description: `Venda: ${itemsSummary}`,
            categoryId: catId,
            accountId: accountId || undefined,
            amount: total,
            dueDate: payload.dueDate || payload.saleDate,
            status: "pending",
            notes: payload.notes,
          });
          if (rec) {
            finalReceivableId = rec.id;
            const updateSalePayload = { receivable_id: rec.id };
            
            setSales(prev => {
              const next = prev.map(s => s.id === saleId ? { ...s, receivableId: rec.id } : s);
              saveSnapshot(effectiveUserId, next, SALES_LIST_SNAPSHOT_STORE).catch(() => {});
              return next;
            });

            if (isOnline) {
              await supabase.from("sales").update(updateSalePayload).eq("id", saleId);
            } else {
              await enqueueMutation({
                userId: effectiveUserId,
                type: 'UPDATE',
                payload: { table: 'sales', data: updateSalePayload, match: { id: saleId } }
              });
            }
          }
        }
      }
      toast.success("Venda registrada!");
      return newSale;
    },
    [user, products, refreshSales, refreshProducts, finance],
  );

  const updateSaleStatus = useCallback(
    async (id: string, status: SaleStatus) => {
      if (!user) return;
      const isOnline = assertOnline() && !user.id.startsWith('guest_');
      const sale = sales.find((s) => s.id === id);
      if (!sale || sale.status === status) return;

      // Optimistic update for sale status
      setSales(prev => {
        const next = prev.map(s => s.id === id ? { ...s, status } : s);
        saveSnapshot(effectiveUserId, next, SALES_LIST_SNAPSHOT_STORE).catch(() => {});
        return next;
      });

      // 1. Handle financial integration (cancelling or completing)
      if (status === "cancelled") {
        // Primeiro tenta pelo receivableId direto (venda a prazo com link explícito)
        if (sale.receivableId) {
          const rec = finance.data.receivables.find(r => r.id === sale.receivableId);
          if (rec) {
            await finance.deleteReceivable(rec.id);
            toast.info('Conta a receber vinculada foi excluída.');
          }
        } else {
          // Fallback: busca por descrição para vendas antigas sem receivable_id
          const saleIdShort = id.slice(0, 8).toUpperCase();
          const rec = finance.data.receivables.find(
            (r) => r.description?.includes(`Venda #${saleIdShort}`) && r.status === "pending",
          );
          if (rec) await finance.deleteReceivable(rec.id);
        }
      } else if (status === "completed" && sale.status === "pending" && sale.receivableId) {
        const rec = finance.data.receivables.find(r => r.id === sale.receivableId);
        if (rec && rec.status === 'pending') {
          await finance.markReceivableReceived(sale.receivableId);
        }
      }

      // 2. Handle stock
      if (sale.status === "completed" && status === "cancelled") {
        for (const item of sale.items) {
          if (item.productId) {
            const prod = products.find((p) => p.id === item.productId);
            if (prod) {
              const nextStock = prod.stockQuantity + item.quantity;
              const stockPayload = { stock_quantity: nextStock, updated_at: new Date().toISOString() };
              
              setProducts(prev => {
                const next = prev.map(p => p.id === item.productId ? { ...p, stockQuantity: nextStock } : p);
                saveSnapshot(effectiveUserId, next, SALES_SNAPSHOT_STORE).catch(() => {});
                return next;
              });

              if (isOnline) {
                await supabase.from("products").update(stockPayload).eq("id", item.productId);
              } else {
                await enqueueMutation({ userId: effectiveUserId, type: 'UPDATE', payload: { table: 'products', data: stockPayload, match: { id: item.productId } } });
              }
            }
          }
        }
      } else if (sale.status !== "completed" && status === "completed") {
        for (const item of sale.items) {
          if (item.productId) {
            const prod = products.find((p) => p.id === item.productId);
            if (prod) {
              const nextStock = Math.max(0, prod.stockQuantity - item.quantity);
              const stockPayload = { stock_quantity: nextStock, updated_at: new Date().toISOString() };
              
              setProducts(prev => {
                const next = prev.map(p => p.id === item.productId ? { ...p, stockQuantity: nextStock } : p);
                saveSnapshot(effectiveUserId, next, SALES_SNAPSHOT_STORE).catch(() => {});
                return next;
              });

              if (isOnline) {
                await supabase.from("products").update(stockPayload).eq("id", item.productId);
              } else {
                await enqueueMutation({ userId: effectiveUserId, type: 'UPDATE', payload: { table: 'products', data: stockPayload, match: { id: item.productId } } });
              }
            }
          }
        }
      }

      // 3. Update sale status in DB
      if (isOnline) {
        const { error } = await supabase.from("sales").update({ status }).eq("id", id);
        if (error) {
          toast.error("Erro ao atualizar venda: " + error.message);
          await refreshSales();
          return;
        }
      } else {
        await enqueueMutation({ userId: effectiveUserId, type: 'UPDATE', payload: { table: 'sales', data: { status }, match: { id } } });
      }

      toast.success("Venda atualizada!");
    },
    [user, sales, finance, products, refreshSales, refreshProducts],
  );

  const updateSaleShipping = useCallback(
    async (id: string, trackingInfo: { trackingCode?: string; carrier?: string; shippingCost?: number; estimatedDelivery?: string }) => {
      if (!user) return;
      const isOnline = assertOnline() && !user.id.startsWith('guest_');
      const sale = sales.find((s) => s.id === id);
      if (!sale) return;

      const updatedSale = { 
        ...sale, 
        trackingCode: trackingInfo.trackingCode ?? sale.trackingCode,
        carrier: trackingInfo.carrier ?? sale.carrier,
        shippingCost: trackingInfo.shippingCost ?? sale.shippingCost,
        estimatedDelivery: trackingInfo.estimatedDelivery ?? sale.estimatedDelivery
      };

      setSales(prev => {
        const next = prev.map(s => s.id === id ? updatedSale : s);
        saveSnapshot(effectiveUserId, next, SALES_LIST_SNAPSHOT_STORE).catch(() => {});
        return next;
      });

      const payload = {
        tracking_code: trackingInfo.trackingCode ?? null,
        carrier: trackingInfo.carrier ?? null,
        shipping_cost: trackingInfo.shippingCost ?? null,
        estimated_delivery: trackingInfo.estimatedDelivery ?? null,
      };

      if (isOnline) {
        const { error } = await supabase.from("sales").update(payload).eq("id", id);
        if (error) {
          toast.error("Erro ao atualizar rastreamento: " + error.message);
          await refreshSales();
        } else {
          toast.success("Informações de entrega atualizadas!");
        }
      } else {
        await enqueueMutation({ userId: effectiveUserId, type: 'UPDATE', payload: { table: 'sales', data: payload, match: { id } } });
        toast.success("Informações de entrega salvas offline");
      }
    },
    [user, sales, refreshSales]
  );

  const deleteSale = useCallback(
    async (id: string) => {
      if (!user) return;
      const isOnline = assertOnline() && !user.id.startsWith('guest_');
      const sale = sales.find((s) => s.id === id);
      if (!sale) return;

      // Optimistic delete for sale
      setSales(prev => {
        const next = prev.filter(s => s.id !== id);
        saveSnapshot(effectiveUserId, next, SALES_LIST_SNAPSHOT_STORE).catch(() => {});
        return next;
      });

      // 1. Remove financial link if pending
      const saleIdShort = id.slice(0, 8).toUpperCase();
      const rec = finance.data.receivables.find(
        (r) => r.description?.includes(`Venda #${saleIdShort}`) && r.status === "pending",
      );
      if (rec) await finance.deleteReceivable(rec.id);

      // 2. Restore stock if completed
      if (sale.status === "completed") {
        for (const item of sale.items) {
          if (item.productId) {
            const prod = products.find((p) => p.id === item.productId);
            if (prod) {
              const nextStock = prod.stockQuantity + item.quantity;
              const stockPayload = { stock_quantity: nextStock, updated_at: new Date().toISOString() };
              
              setProducts(prev => {
                const next = prev.map(p => p.id === item.productId ? { ...p, stockQuantity: nextStock } : p);
                saveSnapshot(effectiveUserId, next, SALES_SNAPSHOT_STORE).catch(() => {});
                return next;
              });

              if (isOnline) {
                await supabase.from("products").update(stockPayload).eq("id", item.productId);
              } else {
                await enqueueMutation({ userId: effectiveUserId, type: 'UPDATE', payload: { table: 'products', data: stockPayload, match: { id: item.productId } } });
              }
            }
          }
        }
      }

      // 3. Delete sale in DB
      if (isOnline) {
        const { error } = await supabase.from("sales").delete().eq("id", id);
        if (error) {
          toast.error("Erro ao excluir venda: " + error.message);
          await refreshSales();
          return;
        }
      } else {
        await enqueueMutation({ userId: effectiveUserId, type: 'DELETE', payload: { table: 'sales', match: { id } } });
        await enqueueMutation({ userId: effectiveUserId, type: 'DELETE', payload: { table: 'sale_items', match: { sale_id: id } } });
      }

      toast.success("Venda excluída!");
    },
    [user, sales, finance, products, refreshSales, refreshProducts],
  );

  // Sincronização segura via Eventos (evita qualquer loop infinito do React)
  useEffect(() => {
    const handleReceivablePaid = (e: any) => {
      const recId = e.detail?.id;
      const desc = e.detail?.description;

      if (recId) {
        const sale = sales.find(s => s.receivableId === recId && s.status === 'pending');
        if (sale) {
          updateSaleStatus(sale.id, "completed").catch(console.error);
          return;
        }
      }

      // Fallback para registros antigos que ainda usam o código na descrição
      if (desc && desc.includes("Venda #")) {
        const match = desc.match(/Venda #([A-F0-9]{8})/);
        if (match) {
          const saleIdShort = match[1];
          const sale = sales.find(
            (s) =>
              s.id.toUpperCase().startsWith(saleIdShort) &&
              s.status === "pending",
          );
          if (sale) {
            updateSaleStatus(sale.id, "completed").catch(console.error);
          }
        }
      }
    };
    const handleReceivablePartial = async (e: any) => {
      const { originalId, newId } = e.detail || {};
      if (originalId && newId && user) {
        const sale = sales.find(s => s.receivableId === originalId);
        if (sale) {
          console.log(`[SalesContext] Sincronizando saldo restante: ${sale.id} -> ${newId}`);
          
          // Update local state optimistically
          setSales(prev => prev.map(s => s.id === sale.id ? { ...s, receivableId: newId } : s));

          const updatePayload = { receivable_id: newId };
          const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

          if (isOnline) {
            const { error } = await supabase.from('sales').update(updatePayload).eq('id', sale.id);
            if (error) {
              if (error.message?.includes('Failed to fetch')) {
                await enqueueMutation({ userId: effectiveUserId, type: 'UPDATE', payload: { table: 'sales', data: updatePayload, match: { id: sale.id } } });
              } else {
                console.error('[SalesContext] Error updating sale receivable link:', error);
              }
            }
          } else {
            await enqueueMutation({ userId: effectiveUserId, type: 'UPDATE', payload: { table: 'sales', data: updatePayload, match: { id: sale.id } } });
          }
        }
      }
    };

    const handleResetSales = () => {
      console.log('[SalesContext] Reiniciando dados de vendas e produtos...');
      setProducts([]);
      setSales([]);
      if (user) {
        import('./offline-store').then(m => {
          m.clearSnapshot(effectiveUserId);
        });
      }
    };

    window.addEventListener('receivable_paid', handleReceivablePaid);
    window.addEventListener('receivable_partial_received', handleReceivablePartial);
    window.addEventListener('reset_sales', handleResetSales);
    return () => {
      window.removeEventListener('receivable_paid', handleReceivablePaid);
      window.removeEventListener('receivable_partial_received', handleReceivablePartial);
      window.removeEventListener('reset_sales', handleResetSales);
    };
  }, [sales, updateSaleStatus, refreshSales]);

  return (
    <SalesContext.Provider
      value={{
        products,
        sales,
        loadingProducts,
        loadingSales,
        addProduct,
        updateProduct,
        deleteProduct,
        createSale,
        updateSaleStatus,
        updateSaleShipping,
        deleteSale,
        refreshSales,
        refreshProducts,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales must be used within SalesProvider");
  return ctx;
}
