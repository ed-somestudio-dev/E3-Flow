import { useFinance } from '@/lib/finance-context';
import { useAuth } from '@/lib/auth-context';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from 'recharts';
import { motion } from 'framer-motion';
import { differenceInCalendarDays } from 'date-fns';
import { fmt, fmtDate } from '@/lib/format';
import { SAFE_LABELS } from '@/lib/safe-labels';
import { consolidatePayables } from '@/lib/consolidate-payables';
import { usePixSettings } from '@/lib/pix-settings-context';
import { APP_VERSION, APP_VERSION_DATE } from '@/lib/version';

function StatCard({ label, value, icon: Icon, trend, color, subValue }: {
  label: string; value: string; icon: React.ElementType; trend?: 'up' | 'down'; color?: string;
  subValue?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="finance-card">
      <div className="flex items-center justify-between mb-3">
        <span className="finance-label">{label}</span>
        <div className="p-2 rounded-lg bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></div>
      </div>
      <p className="finance-stat mono" style={color ? { color } : undefined}>{value}</p>
      {subValue && (
        <p className="text-[10px] text-muted-foreground mt-1">{subValue}</p>
      )}
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
  const { data, getCategoryName, getCategoryColor, getAccountName } = useFinance();
  const { settings, loaded: settingsLoaded } = usePixSettings();
  const { user } = useAuth();
  
  const meta = user?.user_metadata || {};
  const fullName = (meta.full_name || meta.name || '').trim();
  const emailPrefix = user?.email ? user.email.split('@')[0] : '';
  const userName = fullName ? fullName.split(' ')[0] : emailPrefix;

  const consolidated = useMemo(() => consolidatePayables(data.payables, getAccountName), [data.payables, getAccountName]);

  const stats = useMemo(() => {
    const totalBalance = data.accounts.reduce((s, a) => s + a.balance, 0);
    const totalPayable = consolidated.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);
    const totalReceivable = data.receivables.filter(r => r.status !== 'received').reduce((s, r) => s + r.amount, 0);
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = data.transactions.filter(t => t.date.startsWith(monthStr));
    const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const goalsTotal = (data.goalTransactions || []).reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0);
    const patrimonioTotal = totalBalance + goalsTotal;
    return { totalBalance, totalPayable, totalReceivable, monthIncome, monthExpense, patrimonioTotal };
  }, [data]);

  const overduePayables = consolidated.filter(p => p.status === 'overdue');
  const overdueReceivables = data.receivables.filter(r => r.status === 'overdue');

  // Próximas a vencer (dentro da janela de antecedência das configurações)
  const lead = settings.reminderDaysBefore ?? 3;
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingPayables = useMemo(() => consolidated.filter(p => {
    if (p.status === 'paid' || p.status === 'overdue') return false;
    if (p.dueDate < todayStr) return false;
    const d = differenceInCalendarDays(new Date(p.dueDate + 'T12:00:00'), new Date());
    return d >= 0 && d <= lead;
  }), [consolidated, lead, todayStr]);
  const upcomingReceivables = useMemo(() => data.receivables.filter(r => {
    if (r.status === 'received' || r.status === 'overdue') return false;
    if (r.dueDate < todayStr) return false;
    const d = differenceInCalendarDays(new Date(r.dueDate + 'T12:00:00'), new Date());
    return d >= 0 && d <= lead;
  }), [data.receivables, lead, todayStr]);

  const goalReminders = useMemo(() => {
    const reminders: { id: string; title: string; suggestedAmount: number; remaining: number; dueDate: string }[] = [];
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    data.goals.forEach(goal => {
      if (goal.status !== 'active') return;

      // 1. Calculate suggested monthly installment
      let suggested = 0;
      if (goal.targetAmount > 0 && goal.deadlineMonths > 0) {
        if (goal.type === 'save') {
          suggested = goal.targetAmount / goal.deadlineMonths;
        } else {
          const r = (goal.estimatedYield || 0.8) / 100;
          const n = goal.deadlineMonths;
          if (r > 0) {
            suggested = goal.targetAmount * r / (Math.pow(1 + r, n) - 1);
          } else {
            suggested = goal.targetAmount / n;
          }
        }
      }
      suggested = Math.round(suggested * 100) / 100;
      if (suggested <= 0) return;

      // 2. Sum deposits for the current month
      const depositsThisMonth = (data.goalTransactions || [])
        .filter(t => t.goalId === goal.id && t.type === 'deposit' && t.date.startsWith(currentYearMonth))
        .reduce((sum, t) => sum + t.amount, 0);

      const remaining = Math.round((suggested - depositsThisMonth) * 100) / 100;
      if (remaining <= 0.01) return; // Contribution fully made this month

      // 3. Determine due date in the current month based on creation day
      const creationDate = new Date(goal.createdAt);
      const creationDay = creationDate.getDate();
      
      // Get last day of current month to clamp creationDay if necessary
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dueDay = Math.min(creationDay, lastDayOfMonth);
      const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
      const dueDateStr = due.toISOString().split('T')[0];

      reminders.push({
        id: goal.id,
        title: goal.title,
        suggestedAmount: suggested,
        remaining,
        dueDate: dueDateStr
      });
    });

    return reminders;
  }, [data.goals, data.goalTransactions]);

  const overdueGoalReminders = useMemo(() => {
    return goalReminders.filter(g => g.dueDate < todayStr);
  }, [goalReminders, todayStr]);

  const upcomingGoalReminders = useMemo(() => {
    return goalReminders.filter(g => {
      if (g.dueDate < todayStr) return false;
      const d = differenceInCalendarDays(new Date(g.dueDate + 'T12:00:00'), new Date());
      return d >= 0 && d <= lead;
    });
  }, [goalReminders, todayStr, lead]);

  const remindersOn = settingsLoaded && settings.remindersEnabled;
  const showAlertsCard = remindersOn && (
    overduePayables.length + overdueReceivables.length + overdueGoalReminders.length +
    upcomingPayables.length + upcomingReceivables.length + upcomingGoalReminders.length
  ) > 0;

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

  const pendingPayables = consolidated.filter(p => p.status !== 'paid');
  const pendingReceivables = data.receivables.filter(r => r.status !== 'received');

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Olá{userName ? `, ${userName}` : ''} 👋</h1>
          <p className="text-muted-foreground text-sm">Sua visão financeira geral</p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            {APP_VERSION}
          </span>
          <p className="text-[10px] text-muted-foreground mt-1">Atualizado em {APP_VERSION_DATE}</p>
        </div>
      </div>

      {/* Alertas e Lembretes — vencidas + próximas (controlado em Configurações) */}
      {showAlertsCard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="finance-card border-warning/30 bg-warning/5"
          role="region"
          aria-label="Alertas e lembretes"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-warning" />
              <span className="font-semibold text-sm">Alertas e Lembretes</span>
            </div>
            <Link to="/settings" className="text-[10px] text-muted-foreground hover:text-foreground underline">
              configurar
            </Link>
          </div>

          {(overduePayables.length > 0 || overdueReceivables.length > 0 || overdueGoalReminders.length > 0) && (
            <div className="mb-3">
              <div className="flex items-center gap-2 text-destructive mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">Vencidas</span>
              </div>
              <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                {overduePayables.map(p => (
                  <p key={p.id} className="text-muted-foreground">
                    <Link to="/payables" className="text-destructive font-medium hover:underline">{SAFE_LABELS.shortPayable}</Link>: <span className="text-foreground font-medium">{p.description}</span>{p.isInvoice ? ` (${p.itemCount} itens)` : ''} — {fmt(p.amount)} venceu em {fmtDate(p.dueDate)}
                  </p>
                ))}
                {overdueReceivables.map(r => (
                  <p key={r.id} className="text-muted-foreground">
                    <Link to="/receivables" className="text-destructive font-medium hover:underline">{SAFE_LABELS.shortReceivable}</Link>: <span className="text-foreground font-medium">{r.description}</span> de {r.clientName} — {fmt(r.amount)} venceu em {fmtDate(r.dueDate)}
                  </p>
                ))}
                {overdueGoalReminders.map(g => (
                  <p key={g.id} className="text-muted-foreground">
                    <Link to="/goals" className="text-destructive font-medium hover:underline">Meta/Sonho</Link>: Aporte sugerido da meta <span className="text-foreground font-medium">{g.title}</span> de {fmt(g.suggestedAmount)} venceu em {fmtDate(g.dueDate)} (Falta {fmt(g.remaining)})
                  </p>
                ))}
              </div>
            </div>
          )}

          {(upcomingPayables.length > 0 || upcomingReceivables.length > 0 || upcomingGoalReminders.length > 0) && (
            <div>
              <div className="flex items-center gap-2 text-warning mb-1.5">
                <Bell className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Vence em até {lead} dia{lead !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
                {upcomingPayables.map(p => (
                  <p key={p.id} className="text-muted-foreground">
                    <Link to="/payables" className="text-warning font-medium hover:underline">{SAFE_LABELS.shortPayable}</Link>: <span className="text-foreground font-medium">{p.description}</span>{p.isInvoice ? ` (${p.itemCount} itens)` : ''} — {fmt(p.amount)} vence em {fmtDate(p.dueDate)}
                  </p>
                ))}
                {upcomingReceivables.map(r => (
                  <p key={r.id} className="text-muted-foreground">
                    <Link to="/receivables" className="text-warning font-medium hover:underline">{SAFE_LABELS.shortReceivable}</Link>: <span className="text-foreground font-medium">{r.description}</span> de {r.clientName} — {fmt(r.amount)} vence em {fmtDate(r.dueDate)}
                  </p>
                ))}
                {upcomingGoalReminders.map(g => (
                  <p key={g.id} className="text-muted-foreground">
                    <Link to="/goals" className="text-warning font-medium hover:underline">Meta/Sonho</Link>: Aporte sugerido da meta <span className="text-foreground font-medium">{g.title}</span> de {fmt(g.suggestedAmount)} vence em {fmtDate(g.dueDate)} (Falta {fmt(g.remaining)})
                  </p>
                ))}
              </div>
            </div>
          )}
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
                {p.isInvoice && <span className="ml-1 text-xs text-muted-foreground">({p.itemCount} itens)</span>}
                {p.status === 'overdue' && <span className="ml-1 text-xs text-destructive font-semibold">(Vencida)</span>}
                {' — '}{fmt(p.amount)} · {p.status === 'overdue' ? 'Venceu' : 'Vence'} {fmtDate(p.dueDate)}
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
        <StatCard label="Saldo Disponível" value={fmt(stats.totalBalance)} icon={Wallet} subValue={`Patrimônio: ${fmt(stats.patrimonioTotal)}`} />
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
                itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))' }}
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
                  itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))' }}
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
                itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))' }}
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
                    itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))' }}
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
              itemStyle={{ color: 'hsl(var(--foreground))' }} labelStyle={{ color: 'hsl(var(--foreground))' }}
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
