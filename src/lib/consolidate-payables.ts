import { Payable, PayableStatus } from './types';

export interface ConsolidatedPayable {
  id: string;
  description: string;
  supplier: string;
  amount: number;
  dueDate: string;
  status: PayableStatus;
  categoryId: string;
  accountId?: string;
  isInvoice: boolean;
  itemCount: number;
  /** Unique supplier/description names from individual items within an invoice */
  itemSuppliers: string[];
}

/**
 * Consolidates credit card payables (those with purchaseDate) into
 * single invoice entries per account+dueDate-month. Non-credit payables
 * are returned as-is.
 */
export function consolidatePayables(
  payables: Payable[],
  getAccountName: (id: string) => string,
): ConsolidatedPayable[] {
  const result: ConsolidatedPayable[] = [];
  const creditGroups: Record<string, Payable[]> = {};

  for (const p of payables) {
    if (p.purchaseDate && p.accountId) {
      // Group by accountId + dueDate month
      const monthKey = p.dueDate.slice(0, 7); // YYYY-MM
      const groupKey = `${p.accountId}::${monthKey}`;
      if (!creditGroups[groupKey]) creditGroups[groupKey] = [];
      creditGroups[groupKey].push(p);
    } else if (p.supplier?.startsWith('cartao:') && p.accountId) {
      // Also group system-generated invoice entries
      const monthKey = p.dueDate.slice(0, 7);
      const groupKey = `${p.accountId}::${monthKey}`;
      if (!creditGroups[groupKey]) creditGroups[groupKey] = [];
      creditGroups[groupKey].push(p);
    } else {
      result.push({
        id: p.id,
        description: p.description,
        supplier: p.supplier,
        amount: p.amount,
        dueDate: p.dueDate,
        status: p.status as PayableStatus,
        categoryId: p.categoryId,
        accountId: p.accountId,
        isInvoice: false,
        itemCount: 1,
        itemSuppliers: [p.supplier],
      });
    }
  }

  for (const [groupKey, items] of Object.entries(creditGroups)) {
    const [accountId] = groupKey.split('::');
    const totalAmount = items.reduce((s, i) => s + i.amount, 0);
    const allPaid = items.every(i => i.status === 'paid');
    const hasOverdue = items.some(i => i.status === 'overdue');
    const status: PayableStatus = allPaid ? 'paid' : hasOverdue ? 'overdue' : 'pending';
    const accName = getAccountName(accountId);
    // Use earliest due date from the group
    const dueDate = items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0].dueDate;

    // Collect unique supplier/description names (exclude cartao: prefixed ones)
    const uniqueSuppliers = [...new Set(
      items.map(i => {
        if (i.supplier?.startsWith('cartao:')) return i.description;
        return i.supplier || i.description;
      }).filter(Boolean)
    )];

    result.push({
      id: `invoice-${groupKey}`,
      description: `Fatura ${accName}`,
      supplier: accName,
      amount: totalAmount,
      dueDate,
      status,
      categoryId: items[0].categoryId,
      accountId,
      isInvoice: true,
      itemCount: items.length,
      itemSuppliers: uniqueSuppliers,
    });
  }

  return result;
}
