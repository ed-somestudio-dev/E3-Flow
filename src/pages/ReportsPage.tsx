import { useMemo, useState } from 'react';
import { useFinance } from '@/lib/finance-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { fmt } from '@/lib/format';

export default function ReportsPage() {
  const { data, getCategoryName, getCategoryColor } = useFinance();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());

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

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
    borderRadius: '8px', color: 'hsl(var(--foreground))',
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Análise financeira detalhada</p>
        </div>
        <select value={year} onChange={e => setYear(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          {[...Array(5)].map((_, i) => {
            const y = now.getFullYear() - i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>

      {/* Resumo Anual */}
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

      {/* Receitas vs Despesas Mensal */}
      <div className="finance-card">
        <h3 className="font-semibold mb-4">Receitas vs Despesas — Mensal</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlySummary}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
            <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--chart-income))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--chart-expense))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Fluxo de Caixa Acumulado */}
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
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
            <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--chart-4))" fill="url(#gradAcumulado)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Categorias */}
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
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

      {/* Saldo Mensal */}
      <div className="finance-card">
        <h3 className="font-semibold mb-4">Resultado Mensal</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={monthlySummary}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
            <Line type="monotone" dataKey="receitas" name="Receitas" stroke="hsl(var(--chart-income))" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(var(--chart-expense))" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--chart-4))" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
