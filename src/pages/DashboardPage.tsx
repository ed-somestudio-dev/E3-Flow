import { useFinance } from '@/lib/finance-context';
import { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from 'recharts';
import { motion } from 'framer-motion';
import { fmt, fmtDate } from '@/lib/format';
import { SAFE_LABELS } from '@/lib/safe-labels';

function StatCard({ label, value, icon: Icon, trend, color }: {
  label: string; value: string; icon: React.ElementType; trend?: 'up' | 'down'; color?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="finance-card">
      <div className="flex items-center justify-between mb-3">
        <span className="finance-label">{label}</span>
        <div className="p-2 rounded-lg bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></div>
      </div>
      <p className="finance-stat mono" style={color ? { color } : undefined}>{value}</p>
      {trend && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          {trend === 'up' ? <ArrowUpRight className="h-3 w-3 text-success" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
          <span className={trend === 'up' ? 'text-success' : 'text-destructive'}>vs mês anterior</span>
        </div>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data, getCategoryName, getCategoryColor } = useFinance();

  const stats = useMemo(() => {
    const totalBalance = data.accounts.reduce((s, a) => s + a.balance, 0);
    const totalPayable = data.payables.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);
    const totalReceivable = data.receivables.filter(r => r.status !== 'received').reduce((s, r) => s + r.amount, 0);
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = data.transactions.filter(t => t.date.startsWith(monthStr));
    const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { totalBalance, totalPayable, totalReceivable, monthIncome, monthExpense };
  }, [data]);

  const overduePayables = data.payables.filter(p => p.status === 'overdue');
  const overdueReceivables = data.receivables.filter(r => r.status === 'overdue');

  const cashFlowData = useMemo(() => {
    const months: { name: string; receitas: number; despesas: number; saldo: number }[] = [];
    const now = new Date();
    let runningBalance = 0;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short' });
      const txs = data.transactions.filter(t => t.date.startsWith(key));
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      runningBalance += income - expense;
      months.push({ name: label, receitas: income, despesas: expense, saldo: runningBalance });
    }
    return months;
  }, [data.transactions]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    data.transactions.filter(t => t.type === 'expense' && t.date.startsWith(monthStr)).forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([catId, value]) => ({
      name: getCategoryName(catId), value, color: getCategoryColor(catId),
    }));
  }, [data.transactions, getCategoryName, getCategoryColor]);

  // Daily balance for area chart (last 30 days)
  const dailyBalance = useMemo(() => {
    const days: { date: string; saldo: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayTx = data.transactions.filter(t => t.date === key);
      const net = dayTx.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
      const prev = days.length > 0 ? days[days.length - 1].saldo : data.accounts.reduce((s, a) => s + a.balance, 0);
      days.push({ date: `${d.getDate()}/${d.getMonth() + 1}`, saldo: prev + net });
    }
    return days;
  }, [data.transactions, data.accounts]);

  // Income by category (monthly)
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    data.transactions.filter(t => t.type === 'income' && t.date.startsWith(monthStr)).forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([catId, value]) => ({
      name: getCategoryName(catId), value, color: getCategoryColor(catId),
    }));
  }, [data.transactions, getCategoryName, getCategoryColor]);

  const pendingPayables = data.payables.filter(p => p.status !== 'paid');
  const pendingReceivables = data.receivables.filter(r => r.status !== 'received');

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Painel</h1>
        <p className="text-muted-foreground text-sm">Sua visão financeira geral</p>
      </div>

      {/* Alertas */}
      {(overduePayables.length > 0 || overdueReceivables.length > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="finance-card border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold text-sm">Alertas de Atraso</span>
          </div>
          <div className="space-y-1 text-sm">
            {overduePayables.map(p => (
              <p key={p.id} className="text-muted-foreground">
                {SAFE_LABELS.shortPayable}: <span className="text-foreground font-medium">{p.description}</span> — {fmt(p.amount)} venceu em {fmtDate(p.dueDate)}
              </p>
            ))}
            {overdueReceivables.map(r => (
              <p key={r.id} className="text-muted-foreground">
                {SAFE_LABELS.shortReceivable}: <span className="text-foreground font-medium">{r.description}</span> de {r.clientName} — {fmt(r.amount)} venceu em {fmtDate(r.dueDate)}
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {/* Contas a Pagar Pendentes */}
      {pendingPayables.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="finance-card border-destructive/20 bg-destructive/5">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <ArrowDownRight className="h-4 w-4" />
            <span className="font-semibold text-sm">{`${SAFE_LABELS.payables} Pendentes`}</span>
          </div>
          <div className="space-y-1 text-sm max-h-[6.5rem] overflow-y-auto">
            {pendingPayables.map(p => (
              <p key={p.id} className="text-muted-foreground">
                <span className="text-foreground font-medium">{p.description}</span>
                {p.status === 'overdue' && <span className="ml-1 text-xs text-destructive font-semibold">(Vencida)</span>}
                {' — '}{fmt(p.amount)} · {p.status === 'overdue' ? 'Venceu' : 'Vence'} {fmtDate(p.dueDate)}
                {p.recurring && <span className="ml-2 text-xs text-primary">({p.recurrenceFrequency === 'monthly' ? 'Mensal' : p.recurrenceFrequency === 'weekly' ? 'Semanal' : 'Anual'})</span>}
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {/* Contas a Receber Pendentes */}
      {pendingReceivables.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="finance-card border-success/20 bg-success/5">
          <div className="flex items-center gap-2 text-success mb-2">
            <ArrowUpRight className="h-4 w-4" />
            <span className="font-semibold text-sm">{`${SAFE_LABELS.receivables} Pendentes`}</span>
          </div>
          <div className="space-y-1 text-sm max-h-[6.5rem] overflow-y-auto">
            {pendingReceivables.map(r => (
              <p key={r.id} className="text-muted-foreground">
                <span className="text-foreground font-medium">{r.description}</span>
                {r.status === 'overdue' && <span className="ml-1 text-xs text-destructive font-semibold">(Vencida)</span>}
                {' — '}{fmt(r.amount)} · de {r.clientName} · {r.status === 'overdue' ? 'Venceu' : 'Vence'} {fmtDate(r.dueDate)}
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Saldo Total" value={fmt(stats.totalBalance)} icon={Wallet} />
        <StatCard label={SAFE_LABELS.payables} value={fmt(stats.totalPayable)} icon={TrendingDown} color="hsl(var(--destructive))" />
        <StatCard label={SAFE_LABELS.receivables} value={fmt(stats.totalReceivable)} icon={TrendingUp} color="hsl(var(--success))" />
        <StatCard label="Receitas do Mês" value={fmt(stats.monthIncome)} icon={ArrowUpRight} trend="up" />
        <StatCard label="Despesas do Mês" value={fmt(stats.monthExpense)} icon={ArrowDownRight} trend="down" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="finance-card lg:col-span-2">
          <h3 className="font-semibold mb-4">Fluxo de Caixa — Últimos 6 Meses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => fmt(value)} />
              <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--chart-income))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--chart-expense))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="finance-card">
          <h3 className="font-semibold mb-4">Despesas por Categoria</h3>
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {expenseByCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => fmt(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">Sem despesas neste mês</p>
          )}
          <div className="space-y-1 mt-2">
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
        </div>
      </div>

      {/* Evolução do Saldo + Receitas por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="finance-card">
          <h3 className="font-semibold mb-4">Evolução do Saldo — 30 Dias</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyBalance}>
              <defs>
                <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => fmt(value)} />
              <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--chart-1))" fill="url(#gradSaldo)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="finance-card">
          <h3 className="font-semibold mb-4">Receitas por Categoria</h3>
          {incomeByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={incomeByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {incomeByCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => fmt(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
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
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">Sem receitas neste mês</p>
          )}
        </div>
      </div>

      {/* Saldo Acumulado no Fluxo de Caixa */}
      <div className="finance-card">
        <h3 className="font-semibold mb-4">Saldo Acumulado — 6 Meses</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => fmt(value)} />
            <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--chart-4))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--chart-4))' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Transações Recentes */}
      <div className="finance-card">
        <h3 className="font-semibold mb-4">Transações Recentes</h3>
        <div className="space-y-2">
          {data.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{getCategoryName(tx.categoryId)} · {fmtDate(tx.date)}</p>
              </div>
              <span className={`mono text-sm font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
