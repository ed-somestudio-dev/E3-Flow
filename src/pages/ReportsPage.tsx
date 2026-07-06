import { useMemo, useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { fmt, fmtDate } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SAFE_LABELS } from '@/lib/safe-labels';
import { consolidatePayables } from '@/lib/consolidate-payables';
import { MonthYearPicker } from '@/components/MonthYearPicker';
import { format as fmtFn, startOfMonth, endOfMonth } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon, X } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const { data, getCategoryName, getCategoryColor, getAccountName } = useFinance();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());

  // Period filter for payables/receivables
  const todayStr = now.toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };
  const [forecastDateFrom, setForecastDateFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [forecastDateTo, setForecastDateTo] = useState<Date | undefined>(endOfMonth(new Date()));

  const clearForecastDateFilter = () => {
    setForecastDateFrom(undefined);
    setForecastDateTo(undefined);
  };

  // Monthly summary for year
  const monthlySummary = useMemo(() => {
    const months: { name: string; receitas: number; despesas: number; saldo: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      const d = new Date(parseInt(year), m, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' });
      const txs = data.transactions.filter(t => t.date.startsWith(key));
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      months.push({ name: label, receitas: income, despesas: expense, saldo: income - expense });
    }
    return months;
  }, [data.transactions, year]);

  // Annual totals
  const annualTotals = useMemo(() => {
    const txs = data.transactions.filter(t => t.date.startsWith(year));
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [data.transactions, year]);

  // Expenses by category (annual)
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    data.transactions.filter(t => t.type === 'expense' && t.date.startsWith(year)).forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([catId, value]) => ({
      name: getCategoryName(catId), value, color: getCategoryColor(catId),
    })).sort((a, b) => b.value - a.value);
  }, [data.transactions, year, getCategoryName, getCategoryColor]);

  // Income by category (annual)
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    data.transactions.filter(t => t.type === 'income' && t.date.startsWith(year)).forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([catId, value]) => ({
      name: getCategoryName(catId), value, color: getCategoryColor(catId),
    })).sort((a, b) => b.value - a.value);
  }, [data.transactions, year, getCategoryName, getCategoryColor]);

  // Cumulative cash flow
  const cumulativeCashFlow = useMemo(() => {
    let running = 0;
    return monthlySummary.map(m => {
      running += m.saldo;
      return { ...m, acumulado: running };
    });
  }, [monthlySummary]);

  // Payables by period
  const consolidated = useMemo(() => consolidatePayables(data.payables, getAccountName), [data.payables, getAccountName]);

  const payablesByPeriod = useMemo(() => {
    const fromStr = startDate ? fmtFn(startDate, 'yyyy-MM-dd') : undefined;
    const toStr = endDate ? fmtFn(endDate, 'yyyy-MM-dd') : undefined;
    return consolidated
      .filter(p => {
        if (fromStr && p.dueDate < fromStr) return false;
        if (toStr && p.dueDate > toStr) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [consolidated, startDate, endDate]);

  const payablesTotals = useMemo(() => {
    const pending = payablesByPeriod.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);
    const paid = payablesByPeriod.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const overdue = payablesByPeriod.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);
    const total = payablesByPeriod.reduce((s, p) => s + p.amount, 0);
    return { pending, paid, overdue, total };
  }, [payablesByPeriod]);

  // Receivables by period
  const receivablesByPeriod = useMemo(() => {
    const fromStr = startDate ? fmtFn(startDate, 'yyyy-MM-dd') : undefined;
    const toStr = endDate ? fmtFn(endDate, 'yyyy-MM-dd') : undefined;
    return data.receivables
      .filter(r => {
        if (fromStr && r.dueDate < fromStr) return false;
        if (toStr && r.dueDate > toStr) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [data.receivables, startDate, endDate]);

  const receivablesTotals = useMemo(() => {
    const pending = receivablesByPeriod.filter(r => r.status !== 'received').reduce((s, r) => s + r.amount, 0);
    const received = receivablesByPeriod.filter(r => r.status === 'received').reduce((s, r) => s + r.amount, 0);
    const overdue = receivablesByPeriod.filter(r => r.status === 'overdue').reduce((s, r) => s + r.amount, 0);
    const total = receivablesByPeriod.reduce((s, r) => s + r.amount, 0);
    return { pending, received, overdue, total };
  }, [receivablesByPeriod]);

  // Forecast: what will be the financial position on a specific date range
  const forecast = useMemo(() => {
    const currentBalance = data.accounts.reduce((s, a) => s + a.balance, 0);
    const fromStr = forecastDateFrom ? fmtFn(forecastDateFrom, 'yyyy-MM-dd') : undefined;
    const toStr = forecastDateTo ? fmtFn(forecastDateTo, 'yyyy-MM-dd') : undefined;

    const futurePayables = consolidated
      .filter(p => {
        if (p.status === 'paid') return false;
        if (fromStr && p.dueDate < fromStr) return false;
        if (toStr && p.dueDate > toStr) return false;
        return true;
      })
      .reduce((s, p) => s + p.amount, 0);

    const futureReceivables = data.receivables
      .filter(r => {
        if (r.status === 'received') return false;
        if (fromStr && r.dueDate < fromStr) return false;
        if (toStr && r.dueDate > toStr) return false;
        return true;
      })
      .reduce((s, r) => s + r.amount, 0);

    const projected = currentBalance + futureReceivables - futurePayables;
    return { currentBalance, futurePayables, futureReceivables, projected };
  }, [data, consolidated, forecastDateFrom, forecastDateTo]);

  // Filtered payables for forecast list
  const forecastPayables = useMemo(() => {
    const fromStr = forecastDateFrom ? fmtFn(forecastDateFrom, 'yyyy-MM-dd') : undefined;
    const toStr = forecastDateTo ? fmtFn(forecastDateTo, 'yyyy-MM-dd') : undefined;
    return data.payables
      .filter(p => {
        if (p.status === 'paid') return false;
        if (fromStr && p.dueDate < fromStr) return false;
        if (toStr && p.dueDate > toStr) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [data.payables, forecastDateFrom, forecastDateTo]);

  // Filtered receivables for forecast list
  const forecastReceivables = useMemo(() => {
    const fromStr = forecastDateFrom ? fmtFn(forecastDateFrom, 'yyyy-MM-dd') : undefined;
    const toStr = forecastDateTo ? fmtFn(forecastDateTo, 'yyyy-MM-dd') : undefined;
    return data.receivables
      .filter(r => {
        if (r.status === 'received') return false;
        if (fromStr && r.dueDate < fromStr) return false;
        if (toStr && r.dueDate > toStr) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [data.receivables, forecastDateFrom, forecastDateTo]);

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
    borderRadius: '8px', color: 'hsl(var(--foreground))',
  };
  const tooltipItemStyle = { color: 'hsl(var(--foreground))' };
  const tooltipLabelStyle = { color: 'hsl(var(--foreground))', fontWeight: 600 };

  const statusLabel = (s: string) => {
    if (s === 'paid') return 'Pago';
    if (s === 'received') return 'Recebido';
    if (s === 'overdue') return 'Vencida';
    return 'Pendente';
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Análise financeira detalhada</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto items-stretch">
          <TabsTrigger value="general" className="h-full py-2">Geral</TabsTrigger>
          <TabsTrigger value="bills" className="h-full py-2 whitespace-normal text-center leading-tight">{SAFE_LABELS.payablesAndReceivables}</TabsTrigger>
          <TabsTrigger value="forecast" className="h-full py-2">Previsão</TabsTrigger>
        </TabsList>

        {/* === ABA GERAL === */}
        <TabsContent value="general" className="space-y-6 mt-4">
          <div className="flex justify-end">
            <select value={year} onChange={e => setYear(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
              {[...Array(5)].map((_, i) => {
                const y = now.getFullYear() - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="finance-card">
              <p className="finance-label">Total de Receitas</p>
              <p className="finance-stat mono text-success">{fmt(annualTotals.income)}</p>
            </div>
            <div className="finance-card">
              <p className="finance-label">Total de Despesas</p>
              <p className="finance-stat mono text-destructive">{fmt(annualTotals.expense)}</p>
            </div>
            <div className="finance-card">
              <p className="finance-label">Resultado</p>
              <p className={`finance-stat mono ${annualTotals.balance >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(annualTotals.balance)}</p>
            </div>
          </div>

          <div className="finance-card">
            <h3 className="font-semibold mb-4">Receitas vs Despesas — Mensal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlySummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => fmt(value)} />
                <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--chart-income))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--chart-expense))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="finance-card">
            <h3 className="font-semibold mb-4">Fluxo de Caixa Acumulado</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={cumulativeCashFlow}>
                <defs>
                  <linearGradient id="gradAcumulado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => fmt(value)} />
                <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--chart-4))" fill="url(#gradAcumulado)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="finance-card">
              <h3 className="font-semibold mb-4">Despesas por Categoria</h3>
              {expenseByCategory.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                        {expenseByCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => fmt(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-3">
                    {expenseByCategory.map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                          <span>{e.name}</span>
                        </div>
                        <span className="mono text-muted-foreground">{fmt(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-muted-foreground text-sm text-center py-12">Sem dados</p>}
            </div>
            <div className="finance-card">
              <h3 className="font-semibold mb-4">Receitas por Categoria</h3>
              {incomeByCategory.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={incomeByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                        {incomeByCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => fmt(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-3">
                    {incomeByCategory.map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                          <span>{e.name}</span>
                        </div>
                        <span className="mono text-muted-foreground">{fmt(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-muted-foreground text-sm text-center py-12">Sem dados</p>}
            </div>
          </div>

          <div className="finance-card">
            <h3 className="font-semibold mb-4">Resultado Mensal</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlySummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} formatter={(value: number) => fmt(value)} />
                <Line type="monotone" dataKey="receitas" name="Receitas" stroke="hsl(var(--chart-income))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(var(--chart-expense))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--chart-4))" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* === ABA CONTAS A PAGAR/RECEBER === */}
        <TabsContent value="bills" className="space-y-6 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <MonthYearPicker
              value={startDate && endDate && fmtFn(startDate, 'yyyy-MM') === fmtFn(endDate, 'yyyy-MM') ? startDate : undefined}
              onChange={(from, to) => { setStartDate(from); setEndDate(to); }}
              active={!!(startDate && endDate && fmtFn(startDate, 'yyyy-MM') === fmtFn(new Date(), 'yyyy-MM') && fmtFn(endDate, 'yyyy-MM') === fmtFn(new Date(), 'yyyy-MM'))}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {startDate ? fmtFn(startDate, "dd/MM/yyyy") : "Data inicial"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {endDate ? fmtFn(endDate, "dd/MM/yyyy") : "Data final"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={clearDateFilter}>
                <X className="h-4 w-4 mr-1" />Limpar
              </Button>
            )}
          </div>

          {/* Contas a Pagar */}
          <div className="finance-card">
            <h3 className="font-semibold mb-4">{`${SAFE_LABELS.payables} — Período`}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="mono font-semibold text-sm">{fmt(payablesTotals.total)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="mono font-semibold text-sm text-warning">{fmt(payablesTotals.pending)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="mono font-semibold text-sm text-success">{fmt(payablesTotals.paid)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Vencida</p>
                <p className="mono font-semibold text-sm text-destructive">{fmt(payablesTotals.overdue)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fornecedor</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {payablesByPeriod.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2 px-3 mono text-muted-foreground">{fmtDate(p.dueDate)}</td>
                      <td className={`py-2 px-3 font-medium ${p.status === 'overdue' ? 'text-destructive' : p.status === 'paid' ? 'text-success' : 'text-warning'}`}>
                        {p.description}
                        {p.isInvoice && <span className="ml-1 text-xs text-muted-foreground">({p.itemCount} itens)</span>}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {p.isInvoice && p.itemSuppliers.length > 0 ? (
                          <span title={p.itemSuppliers.join(', ')}>
                            {p.itemSuppliers.length <= 3
                              ? p.itemSuppliers.join(', ')
                              : `${p.itemSuppliers.slice(0, 3).join(', ')} +${p.itemSuppliers.length - 3}`}
                          </span>
                        ) : p.supplier}
                      </td>
                      <td className={`py-2 px-3 font-medium ${p.status === 'overdue' ? 'text-destructive' : p.status === 'paid' ? 'text-success' : 'text-warning'}`}>
                        {statusLabel(p.status)}
                      </td>
                      <td className="py-2 px-3 text-right mono font-semibold text-destructive">{fmt(p.amount)}</td>
                    </tr>
                  ))}
                  {payablesByPeriod.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma conta no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contas a Receber */}
          <div className="finance-card">
            <h3 className="font-semibold mb-4">{`${SAFE_LABELS.receivables} — Período`}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="mono font-semibold text-sm">{fmt(receivablesTotals.total)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="mono font-semibold text-sm text-warning">{fmt(receivablesTotals.pending)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="mono font-semibold text-sm text-success">{fmt(receivablesTotals.received)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Vencida</p>
                <p className="mono font-semibold text-sm text-destructive">{fmt(receivablesTotals.overdue)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {receivablesByPeriod.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-2 px-3 mono text-muted-foreground">{fmtDate(r.dueDate)}</td>
                      <td className={`py-2 px-3 font-medium ${r.status === 'overdue' ? 'text-destructive' : r.status === 'received' ? 'text-success' : 'text-warning'}`}>{r.description}</td>
                      <td className="py-2 px-3 text-muted-foreground">{r.clientName}</td>
                      <td className={`py-2 px-3 font-medium ${r.status === 'overdue' ? 'text-destructive' : r.status === 'received' ? 'text-success' : 'text-warning'}`}>
                        {statusLabel(r.status)}
                      </td>
                      <td className="py-2 px-3 text-right mono font-semibold text-success">{fmt(r.amount)}</td>
                    </tr>
                  ))}
                  {receivablesByPeriod.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma conta no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* === ABA PREVISÃO === */}
        <TabsContent value="forecast" className="space-y-6 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <MonthYearPicker
              value={forecastDateFrom && forecastDateTo && fmtFn(forecastDateFrom, 'yyyy-MM') === fmtFn(forecastDateTo, 'yyyy-MM') ? forecastDateFrom : undefined}
              onChange={(from, to) => { setForecastDateFrom(from); setForecastDateTo(to); }}
              active={!!(forecastDateFrom && forecastDateTo && fmtFn(forecastDateFrom, 'yyyy-MM') === fmtFn(new Date(), 'yyyy-MM') && fmtFn(forecastDateTo, 'yyyy-MM') === fmtFn(new Date(), 'yyyy-MM'))}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !forecastDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {forecastDateFrom ? fmtFn(forecastDateFrom, "dd/MM/yyyy") : "Data inicial"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={forecastDateFrom} onSelect={setForecastDateFrom} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !forecastDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {forecastDateTo ? fmtFn(forecastDateTo, "dd/MM/yyyy") : "Data final"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={forecastDateTo} onSelect={setForecastDateTo} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
            {(forecastDateFrom || forecastDateTo) && (
              <Button variant="ghost" size="sm" onClick={clearForecastDateFilter}>
                <X className="h-4 w-4 mr-1" />Limpar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="finance-card">
              <p className="finance-label">Saldo Atual</p>
              <p className="finance-stat mono">{fmt(forecast.currentBalance)}</p>
            </div>
            <div className="finance-card">
              <p className="finance-label">
                {SAFE_LABELS.shortReceivable}{' '}
                {forecastDateFrom && forecastDateTo
                  ? `de ${fmtFn(forecastDateFrom, 'dd/MM')} a ${fmtFn(forecastDateTo, 'dd/MM')}`
                  : forecastDateTo
                    ? `até ${fmtFn(forecastDateTo, 'dd/MM')}`
                    : forecastDateFrom
                      ? `desde ${fmtFn(forecastDateFrom, 'dd/MM')}`
                      : 'total'}
              </p>
              <p className="finance-stat mono text-success">{fmt(forecast.futureReceivables)}</p>
            </div>
            <div className="finance-card">
              <p className="finance-label">
                {SAFE_LABELS.shortPayable}{' '}
                {forecastDateFrom && forecastDateTo
                  ? `de ${fmtFn(forecastDateFrom, 'dd/MM')} a ${fmtFn(forecastDateTo, 'dd/MM')}`
                  : forecastDateTo
                    ? `até ${fmtFn(forecastDateTo, 'dd/MM')}`
                    : forecastDateFrom
                      ? `desde ${fmtFn(forecastDateFrom, 'dd/MM')}`
                      : 'total'}
              </p>
              <p className="finance-stat mono text-destructive">{fmt(forecast.futurePayables)}</p>
            </div>
            <div className="finance-card border-primary/30">
              <p className="finance-label">Saldo Projetado</p>
              <p className={`finance-stat mono ${forecast.projected >= 0 ? 'text-success' : 'text-destructive'}`}>
                {fmt(forecast.projected)}
              </p>
            </div>
          </div>

          <div className="finance-card">
            <h3 className="font-semibold mb-3">Detalhamento da Previsão</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Contas pendentes com vencimento{' '}
              {forecastDateFrom && forecastDateTo
                ? `entre ${fmtDate(fmtFn(forecastDateFrom, 'yyyy-MM-dd'))} e ${fmtDate(fmtFn(forecastDateTo, 'yyyy-MM-dd'))}`
                : forecastDateFrom
                  ? `a partir de ${fmtDate(fmtFn(forecastDateFrom, 'yyyy-MM-dd'))}`
                  : forecastDateTo
                    ? `até ${fmtDate(fmtFn(forecastDateTo, 'yyyy-MM-dd'))}`
                    : 'em qualquer período'}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-destructive mb-2">Saídas Previstas</h4>
                <div className="space-y-1">
                  {forecastPayables.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium">{p.description}</span>
                        <span className="text-xs text-muted-foreground ml-2">{fmtDate(p.dueDate)}</span>
                      </div>
                      <span className="mono text-destructive font-semibold">{fmt(p.amount)}</span>
                    </div>
                  ))}
                  {forecastPayables.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma saída prevista</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-success mb-2">Entradas Previstas</h4>
                <div className="space-y-1">
                  {forecastReceivables.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div>
                        <span className="font-medium">{r.description}</span>
                        <span className="text-xs text-muted-foreground ml-2">{fmtDate(r.dueDate)}</span>
                      </div>
                      <span className="mono text-success font-semibold">{fmt(r.amount)}</span>
                    </div>
                  ))}
                  {forecastReceivables.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrada prevista</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
