import { useFinance } from '@/lib/finance-context';
import { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';

function StatCard({ label, value, icon: Icon, trend, color }: {
  label: string; value: string; icon: React.ElementType; trend?: 'up' | 'down'; color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="finance-card"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="finance-label">{label}</span>
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <p className="finance-stat mono" style={color ? { color } : undefined}>{value}</p>
      {trend && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          {trend === 'up' ? (
            <ArrowUpRight className="h-3 w-3 text-success" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-destructive" />
          )}
          <span className={trend === 'up' ? 'text-success' : 'text-destructive'}>vs last month</span>
        </div>
      )}
    </motion.div>
  );
}

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

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

  // Cash flow last 6 months
  const cashFlowData = useMemo(() => {
    const months: { name: string; income: number; expense: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const txs = data.transactions.filter(t => t.date.startsWith(key));
      months.push({
        name: label,
        income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      });
    }
    return months;
  }, [data.transactions]);

  // Expenses by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    data.transactions.filter(t => t.type === 'expense' && t.date.startsWith(monthStr)).forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(map).map(([catId, value]) => ({
      name: getCategoryName(catId),
      value,
      color: getCategoryColor(catId),
    }));
  }, [data.transactions, getCategoryName, getCategoryColor]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your financial overview</p>
      </div>

      {/* Alerts */}
      {(overduePayables.length > 0 || overdueReceivables.length > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="finance-card border-destructive/30 bg-destructive/5"
        >
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold text-sm">Overdue Alerts</span>
          </div>
          <div className="space-y-1 text-sm">
            {overduePayables.map(p => (
              <p key={p.id} className="text-muted-foreground">
                Bill: <span className="text-foreground font-medium">{p.description}</span> — {fmt(p.amount)} due {p.dueDate}
              </p>
            ))}
            {overdueReceivables.map(r => (
              <p key={r.id} className="text-muted-foreground">
                Receivable: <span className="text-foreground font-medium">{r.description}</span> from {r.clientName} — {fmt(r.amount)} due {r.dueDate}
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Balance" value={fmt(stats.totalBalance)} icon={Wallet} />
        <StatCard label="Accounts Payable" value={fmt(stats.totalPayable)} icon={TrendingDown} color="hsl(var(--destructive))" />
        <StatCard label="Accounts Receivable" value={fmt(stats.totalReceivable)} icon={TrendingUp} color="hsl(var(--success))" />
        <StatCard label="Monthly Income" value={fmt(stats.monthIncome)} icon={ArrowUpRight} trend="up" />
        <StatCard label="Monthly Expenses" value={fmt(stats.monthExpense)} icon={ArrowDownRight} trend="down" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="finance-card lg:col-span-2">
          <h3 className="font-semibold mb-4">Cash Flow — Last 6 Months</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Bar dataKey="income" fill="hsl(var(--chart-income))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="hsl(var(--chart-expense))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="finance-card">
          <h3 className="font-semibold mb-4">Expenses by Category</h3>
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {expenseByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number) => fmt(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">No expenses this month</p>
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

      {/* Recent Transactions */}
      <div className="finance-card">
        <h3 className="font-semibold mb-4">Recent Transactions</h3>
        <div className="space-y-2">
          {data.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{getCategoryName(tx.categoryId)} · {tx.date}</p>
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
