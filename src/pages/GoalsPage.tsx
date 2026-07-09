import { useState, useMemo } from 'react';
import { usePersistedDialog, usePersistedFormDraft } from '@/hooks/usePersistedDialog';
import { useFinance } from '@/lib/finance-context';
import { Goal, GoalTransaction } from '@/lib/types';
import { Plus, Trash2, Edit2, Calendar, Wallet, Trophy, Sparkles, TrendingUp, ArrowRightLeft, ArrowDownRight, ArrowUpRight, HelpCircle, Archive, AlertCircle } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { fmt, fmtDate } from '@/lib/format';
import { CalculatorInput } from '@/components/CalculatorInput';
import { toast } from 'sonner';

export default function GoalsPage() {
  const { data, addGoal, updateGoal, deleteGoal, depositToGoal, withdrawFromGoal } = useFinance();
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  
  // Modals state
  const [createOpen, setCreateOpen] = usePersistedDialog('goals-create-dialog');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [depositOpen, setDepositOpen] = usePersistedDialog('goals-deposit-dialog');
  const [withdrawOpen, setWithdrawOpen] = usePersistedDialog('goals-withdraw-dialog');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [celebrationGoalName, setCelebrationGoalName] = useState<string | null>(null);

  // Goal transactions calculations
  const goalBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    data.goals.forEach(g => {
      balances[g.id] = 0;
    });
    data.goalTransactions.forEach(t => {
      if (t.type === 'deposit') {
        balances[t.goalId] = (balances[t.goalId] || 0) + t.amount;
      } else {
        balances[t.goalId] = (balances[t.goalId] || 0) - t.amount;
      }
    });
    return balances;
  }, [data.goals, data.goalTransactions]);

  const filteredGoals = useMemo(() => {
    return data.goals.filter(g => activeTab === 'active' ? g.status === 'active' : g.status === 'archived');
  }, [data.goals, activeTab]);

  const totalSaved = useMemo(() => {
    return Object.values(goalBalances).reduce((sum, b) => sum + b, 0);
  }, [goalBalances]);

  const activeGoalsCount = useMemo(() => {
    return data.goals.filter(g => g.status === 'active').length;
  }, [data.goals]);

  // Handle open actions
  const openDetails = (goal: Goal) => {
    setSelectedGoal(goal);
    setDetailsOpen(true);
  };

  const openDeposit = (goal: Goal, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGoal(goal);
    setDepositOpen(true);
  };

  const openWithdraw = (goal: Goal, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGoal(goal);
    setWithdrawOpen(true);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Metas e Sonhos
          </h1>
          <p className="text-muted-foreground text-sm">Organize e aloque seu patrimônio para objetivos específicos</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedGoal(null)}>
              <Plus className="h-4 w-4 mr-2" />Nova Meta / Sonho
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{selectedGoal ? 'Editar' : 'Nova'} Meta / Sonho</DialogTitle>
              <DialogDescription>Defina o objetivo, prazo e modalidade de destinação do dinheiro.</DialogDescription>
            </DialogHeader>
            <GoalForm key={selectedGoal?.id || 'new'}
              goal={selectedGoal}
              accounts={data.accounts}
              onSave={async (g) => {
                if (selectedGoal) {
                  await updateGoal({ ...selectedGoal, ...g } as Goal);
                } else {
                  await addGoal(g);
                }
                setCreateOpen(false);
                setSelectedGoal(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="finance-card flex items-center justify-between p-4">
          <div>
            <span className="finance-label">Patrimônio em Metas</span>
            <p className="finance-stat mono text-success">{fmt(totalSaved)}</p>
          </div>
          <div className="p-3 rounded-xl bg-success/10 text-success">
            <Wallet className="h-5 w-5" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="finance-card flex items-center justify-between p-4">
          <div>
            <span className="finance-label">Metas Ativas</span>
            <p className="finance-stat mono">{activeGoalsCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="finance-card flex items-center justify-between p-4">
          <div>
            <span className="finance-label">Aportes Automáticos</span>
            <p className="finance-stat mono">
              {fmt(data.goals.filter(g => g.status === 'active' && g.autoDeposit).reduce((s, g) => s + g.autoDepositAmount, 0))}
              <span className="text-xs text-muted-foreground font-normal"> /mês</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
            <Sparkles className="h-5 w-5" />
          </div>
        </motion.div>
      </div>

      {/* Tabs list */}
      <div className="flex items-center border-b border-border gap-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-2 text-sm font-semibold transition-colors relative ${
            activeTab === 'active' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Ativas
          {activeTab === 'active' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`pb-2 text-sm font-semibold transition-colors relative ${
            activeTab === 'archived' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Arquivadas
          {activeTab === 'archived' && (
            <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGoals.map((goal) => {
          const saved = goalBalances[goal.id] || 0;
          const progress = goal.targetAmount > 0 ? Math.min(100, (saved / goal.targetAmount) * 100) : 0;
          const isCompleted = saved >= goal.targetAmount;

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => openDetails(goal)}
              className="finance-card group hover:shadow-md transition-all cursor-pointer border-border relative overflow-hidden bg-card/65 backdrop-blur-md"
            >
              {/* Modality Badge */}
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    goal.type === 'save' 
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                      : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                  }`}>
                    {goal.type === 'save' ? <Wallet className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {goal.type === 'save' ? 'Apenas Guardar' : 'Investir'}
                  </span>
                  {goal.autoDeposit && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 ml-2">
                      Aporte Automático
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGoal(goal);
                      setCreateOpen(true);
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(goal.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Title & Target */}
              <div className="space-y-1">
                <h3 className="text-lg font-bold truncate group-hover:text-primary transition-colors">{goal.title}</h3>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Progresso</span>
                  <span className="text-sm font-semibold mono">
                    {fmt(saved)} <span className="text-xs text-muted-foreground font-normal">de {fmt(goal.targetAmount)}</span>
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <Progress value={progress} className={`h-2.5 ${isCompleted ? 'bg-success/20' : ''}`} />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                  <span className="font-medium text-foreground">{Math.round(progress)}% concluído</span>
                  <span>{goal.deadlineMonths} meses</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-border flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saved <= 0}
                  onClick={(e) => openWithdraw(goal, e)}
                  className="h-8 text-xs font-semibold"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-destructive" />
                  Resgatar
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => openDeposit(goal, e)}
                  className="h-8 text-xs font-semibold"
                >
                  <ArrowDownRight className="h-3.5 w-3.5 mr-1 text-success" />
                  Aportar
                </Button>
              </div>
            </motion.div>
          );
        })}

        {filteredGoals.length === 0 && (
          <div className="col-span-full text-center py-16 finance-card text-muted-foreground bg-card/65 backdrop-blur-md">
            <Trophy className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold text-sm">Nenhuma meta / sonho cadastrado</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
              Comece a separar seu patrimônio criando uma nova meta para seus planos de curto ou longo prazo.
            </p>
          </div>
        )}
      </div>

      {/* Goal Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {selectedGoal && (
            <GoalDetails
              goal={selectedGoal}
              balance={goalBalances[selectedGoal.id] || 0}
              transactions={data.goalTransactions.filter(t => t.goalId === selectedGoal.id)}
              getAccountName={(id) => data.accounts.find(a => a.id === id)?.name || 'N/A'}
              onArchive={async () => {
                await updateGoal({ ...selectedGoal, status: selectedGoal.status === 'active' ? 'archived' : 'active' });
                setDetailsOpen(false);
              }}
              onClose={() => setDetailsOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Deposit/Aporte Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Depositar na Meta</DialogTitle>
            <DialogDescription>Movimentação interna. O dinheiro sai do saldo da conta e vai para a meta.</DialogDescription>
          </DialogHeader>
          {selectedGoal && (
            <GoalTransactionForm
              type="deposit"
              goal={selectedGoal}
              accounts={data.accounts}
              onSave={async (accountId, amount, date) => {
                const currentSaved = goalBalances[selectedGoal.id] || 0;
                const newSaved = currentSaved + amount;
                await depositToGoal(selectedGoal.id, accountId, amount, date);
                setDepositOpen(false);
                toast.success('Aporte realizado com sucesso');

                if (newSaved >= selectedGoal.targetAmount && currentSaved < selectedGoal.targetAmount) {
                  // Trigger confetti / celebration
                  setTimeout(() => {
                    setCelebrationGoalName(selectedGoal.title);
                  }, 400);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw/Resgate Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Resgatar da Meta</DialogTitle>
            <DialogDescription>Retirar dinheiro da meta e devolvê-lo para o saldo disponível da conta.</DialogDescription>
          </DialogHeader>
          {selectedGoal && (
            <GoalTransactionForm
              type="withdrawal"
              goal={selectedGoal}
              currentBalance={goalBalances[selectedGoal.id] || 0}
              accounts={data.accounts}
              onSave={async (accountId, amount, date) => {
                await withdrawFromGoal(selectedGoal.id, accountId, amount, date);
                setWithdrawOpen(false);
                toast.success('Resgate efetuado com sucesso');
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onConfirm={async () => {
          if (deleteId) {
            await deleteGoal(deleteId);
            setDeleteId(null);
            toast.success('Meta excluída com sucesso');
          }
        }}
        title="Excluir Meta?"
        description="Tem certeza que deseja excluir esta meta? Isso apagará o registro e o histórico de transações associados (os saldos de suas contas físicas não serão alterados de volta automaticamente)."
      />

      {celebrationGoalName && (
        <GoalCelebration
          goalName={celebrationGoalName}
          onClose={() => setCelebrationGoalName(null)}
        />
      )}
    </div>
  );
}

// Celebration/Confetti screen component
function GoalCelebration({ goalName, onClose }: { goalName: string; onClose: () => void }) {
  const particles = useMemo(() => {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'];
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 350,
      y: (Math.random() - 0.5) * 350 - 150,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.3,
      duration: Math.random() * 2 + 1.5,
      angle: Math.random() * 360,
    }));
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-4 cursor-pointer"
        onClick={onClose}
      >
        <div className="relative max-w-sm w-full bg-card border border-border rounded-2xl shadow-2xl p-8 text-center overflow-hidden">
          {/* Confetti particles radiating from center */}
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
              animate={{
                x: p.x * 2,
                y: p.y * 2 + 300,
                opacity: 0,
                scale: [0, 1, 1, 0.5, 0],
                rotate: p.angle + 360,
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: "easeOut",
              }}
              style={{
                position: 'absolute',
                left: '50%',
                top: '40%',
                width: p.size,
                height: p.size,
                borderRadius: Math.random() > 0.5 ? '50%' : '0%',
                backgroundColor: p.color,
              }}
            />
          ))}

          {/* Sparkles and Icons */}
          <div className="relative justify-center flex mb-6">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ 
                scale: [0, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: 0.1
              }}
              className="p-5 rounded-full bg-amber-500/10 text-amber-500 relative z-10"
            >
              <Trophy className="h-16 w-16" />
            </motion.div>
            
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-amber-500/5 rounded-full blur-xl filter"
            />
          </div>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-black text-foreground mb-2"
          >
            Meta Concluída! 🎉
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-muted-foreground mb-6 leading-relaxed"
          >
            Parabéns! Você atingiu 100% do seu objetivo para <span className="font-bold text-foreground">"{goalName}"</span>. Seu foco e disciplina financeira deram resultado!
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={onClose}
              className="w-full font-bold h-11 bg-amber-500 text-amber-950 hover:bg-amber-500/90 rounded-xl"
            >
              Uhuul, muito bom! 🚀
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Goals creation/edit form component
function GoalForm({ goal, accounts, onSave }: {
  goal: Goal | null;
  accounts: any[];
  onSave: (g: Omit<Goal, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
}) {
  const initialDraft = {
    title: goal?.title || '',
    targetAmount: goal?.targetAmount?.toString() || '',
    deadlineMonths: goal?.deadlineMonths?.toString() || '12',
    type: (goal?.type || 'save') as 'save' | 'invest',
    estimatedYield: goal?.estimatedYield?.toString() || '0.8',
    autoDeposit: goal?.autoDeposit || false,
    autoDepositDay: goal?.autoDepositDay?.toString() || '10',
    accountId: goal?.accountId || accounts[0]?.id || ''
  };
  const [draft, setDraft, clearDraft] = usePersistedFormDraft(`goals-form-${goal?.id || 'new'}`, true, initialDraft);
  const { title, targetAmount, deadlineMonths, type, estimatedYield, autoDeposit, autoDepositDay, accountId } = draft;
  const setTitle = (v: string) => setDraft(d => ({ ...d, title: v }));
  const setTargetAmount = (v: string) => setDraft(d => ({ ...d, targetAmount: v }));
  const setDeadlineMonths = (v: string) => setDraft(d => ({ ...d, deadlineMonths: v }));
  const setType = (v: 'save' | 'invest') => setDraft(d => ({ ...d, type: v }));
  const setEstimatedYield = (v: string) => setDraft(d => ({ ...d, estimatedYield: v }));
  const setAutoDeposit = (v: boolean) => setDraft(d => ({ ...d, autoDeposit: v }));
  const setAutoDepositDay = (v: string) => setDraft(d => ({ ...d, autoDepositDay: v }));
  const setAccountId = (v: string) => setDraft(d => ({ ...d, accountId: v }));

  // Recommended Modality Calculation
  const monthsVal = parseInt(deadlineMonths) || 0;
  const suggestedType = monthsVal < 12 ? 'save' : 'invest';

  // Automatically update type when months change (if not customized by user)
  const handleMonthsChange = (val: string) => {
    setDeadlineMonths(val);
    const m = parseInt(val) || 0;
    setType(m < 12 ? 'save' : 'invest');
  };

  // Parcela calculations
  const simTarget = parseFloat(targetAmount) || 0;
  const simMonths = parseInt(deadlineMonths) || 1;
  const simRate = parseFloat(estimatedYield) / 100 || 0.008;

  const installmentDetails = useMemo(() => {
    if (simTarget <= 0) return { linear: 0, compound: 0, saving: 0 };
    
    // Linear (Save)
    const linear = Math.round((simTarget / simMonths) * 100) / 100;
    
    // Compound Interest (Annuity Future Value)
    // PMT = FV * r / ((1+r)^n - 1)
    let compound = linear;
    if (simRate > 0) {
      compound = Math.round((simTarget * simRate / (Math.pow(1 + simRate, simMonths) - 1)) * 100) / 100;
    }
    
    const saving = Math.max(0, Math.round((linear - compound) * 100) / 100);
    return { linear, compound, saving };
  }, [simTarget, simMonths, simRate]);

  // Set default autoDeposit amount based on selected type
  const autoDepositAmount = type === 'save' ? installmentDetails.linear : installmentDetails.compound;

  return (
    <div className="space-y-4 py-2">
      <div>
        <Label>Título do Sonho / Meta</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Reserva de Emergência, Carro Novo" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor Alvo (R$)</Label>
          <CalculatorInput value={targetAmount} onChange={setTargetAmount} placeholder="0,00" />
        </div>
        <div>
          <Label>Prazo (Meses)</Label>
          <Input type="number" min="1" value={deadlineMonths} onChange={e => handleMonthsChange(e.target.value)} />
        </div>
      </div>

      {/* Suggested Modality recommendation */}
      <div className="bg-muted/40 p-3 rounded-lg flex items-start gap-2 border border-border">
        <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-semibold">Recomendação:</p>
          <p className="text-muted-foreground">
            Para o prazo de <span className="font-medium text-foreground">{simMonths} meses</span>, sugerimos a modalidade{' '}
            <span className={`font-semibold ${suggestedType === 'save' ? 'text-blue-500' : 'text-purple-500'}`}>
              {suggestedType === 'save' ? 'Apenas Guardar' : 'Investir'}
            </span>.
          </p>
        </div>
      </div>

      {/* Modality Selector */}
      <div className="space-y-2">
        <Label>Modalidade</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('save')}
            className={`p-3 rounded-lg border text-left transition-all ${
              type === 'save'
                ? 'border-blue-500 bg-blue-500/5 text-blue-900 dark:text-blue-200'
                : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
              <Wallet className="h-3.5 w-3.5" />
              Apenas Guardar
            </div>
            <p className="text-[10px] leading-relaxed opacity-80">Segurança, linearidade e liquidez imediata. Rendimento linear (CDI).</p>
          </button>
          
          <button
            type="button"
            onClick={() => setType('invest')}
            className={`p-3 rounded-lg border text-left transition-all ${
              type === 'invest'
                ? 'border-purple-500 bg-purple-500/5 text-purple-900 dark:text-purple-200'
                : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Investir
            </div>
            <p className="text-[10px] leading-relaxed opacity-80">Juros compostos ao seu favor. Aportes menores para o mesmo alvo.</p>
          </button>
        </div>
      </div>

      {/* Yield Rate (only for Investir) */}
      {type === 'invest' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1">
              Rendimento Estimado (% a.m.)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="w-48 text-xs leading-normal">
                      Taxa mensal estimada que a carteira de investimentos irá render. O padrão de mercado hoje gira em torno de 0.8% a 1.0% a.m.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
          </div>
          <Input type="number" step="0.05" value={estimatedYield} onChange={e => setEstimatedYield(e.target.value)} />
        </motion.div>
      )}

      {/* Parcel Projection Box */}
      {simTarget > 0 && (
        <div className="bg-card border border-border p-3.5 rounded-xl space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Aporte linear (Apenas Guardar):</span>
            <span className="font-semibold text-foreground">{fmt(installmentDetails.linear)}/mês</span>
          </div>
          
          {type === 'invest' && (
            <>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Aporte projetado (Investimentos):</span>
                <span className="font-semibold text-purple-500">{fmt(installmentDetails.compound)}/mês</span>
              </div>
              <div className="pt-2 border-t border-dashed border-border flex items-center justify-between text-[11px] text-success font-semibold">
                <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Economia mensal:</span>
                <span>{fmt(installmentDetails.saving)}/mês</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal mt-1 bg-success/5 p-2 rounded-lg border border-success/15">
                Investindo, você precisará desembolsar um total de <b>{fmt(installmentDetails.compound * simMonths)}</b> do bolso. 
                Os juros estimados gerarão o restante (<b>{fmt(simTarget - (installmentDetails.compound * simMonths))}</b>) ao final dos {simMonths} meses!
              </p>
            </>
          )}
        </div>
      )}

      {/* Auto Deposit Options */}
      <div className="border-t border-border pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-semibold">Aporte Automático</Label>
            <p className="text-[10px] text-muted-foreground leading-none">Gera lembretes de débito automático recorrente mensal.</p>
          </div>
          <Switch checked={autoDeposit} onCheckedChange={setAutoDeposit} />
        </div>

        {autoDeposit && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <Label>Dia do Aporte</Label>
              <Input type="number" min="1" max="28" value={autoDepositDay} onChange={e => setAutoDepositDay(e.target.value)} />
            </div>
            <div>
              <Label>Conta de Débito</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        )}
      </div>

      <Button
        className="w-full mt-4"
        disabled={!title || !targetAmount || !deadlineMonths}
        onClick={() => { clearDraft(); onSave({
          title,
          targetAmount: parseFloat(targetAmount),
          deadlineMonths: parseInt(deadlineMonths),
          type,
          estimatedYield: parseFloat(estimatedYield),
          autoDeposit,
          autoDepositAmount: autoDepositAmount,
          autoDepositDay: autoDeposit ? parseInt(autoDepositDay) : undefined,
          accountId: autoDeposit ? accountId : undefined,
        }); }}
      >
        {goal ? 'Salvar Alterações' : 'Criar Sonho / Meta'}
      </Button>
    </div>
  );
}

// Deposit / Withdrawal Dialog content
function GoalTransactionForm({ type, goal, currentBalance = 0, accounts, onSave }: {
  type: 'deposit' | 'withdrawal';
  goal: Goal;
  currentBalance?: number;
  accounts: any[];
  onSave: (accountId: string, amount: number, date: string) => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const suggestedInstallment = useMemo(() => {
    if (goal.targetAmount <= 0 || goal.deadlineMonths <= 0) return 0;
    if (goal.type === 'save') {
      return Math.round((goal.targetAmount / goal.deadlineMonths) * 100) / 100;
    } else {
      const r = (goal.estimatedYield || 0.8) / 100;
      const n = goal.deadlineMonths;
      if (r <= 0) return Math.round((goal.targetAmount / n) * 100) / 100;
      return Math.round((goal.targetAmount * r / (Math.pow(1 + r, n) - 1)) * 100) / 100;
    }
  }, [goal]);

  return (
    <div className="space-y-4 py-2">
      <div>
        <Label>Meta</Label>
        <Input value={goal.title} disabled className="bg-muted/30" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{type === 'deposit' ? 'Conta de Origem' : 'Conta de Destino'}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Valor (R$)</Label>
        <CalculatorInput value={amount} onChange={setAmount} placeholder="0,00" />
        {type === 'withdrawal' && (
          <p className="text-[10px] text-muted-foreground mt-1">Saldo máximo para resgate: <b>{fmt(currentBalance)}</b></p>
        )}
        {type === 'deposit' && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Aporte mensal sugerido:{' '}
            <button
              type="button"
              className="font-semibold text-primary underline hover:text-primary/80 transition-colors"
              onClick={() => setAmount(suggestedInstallment.toString())}
            >
              {fmt(suggestedInstallment)}
            </button>
            /mês {goal.type === 'invest' ? `(juros compostos de ${goal.estimatedYield}% a.m.)` : ''}
          </p>
        )}
      </div>

      <Button
        className="w-full mt-2"
        disabled={
          !accountId || 
          !amount || 
          (type === 'withdrawal' && parseFloat(amount) > currentBalance)
        }
        onClick={() => onSave(accountId, parseFloat(amount), date)}
      >
        Confirmar {type === 'deposit' ? 'Aporte' : 'Resgate'}
      </Button>
    </div>
  );
}

// Details Viewer
function GoalDetails({ goal, balance, transactions, getAccountName, onArchive, onClose }: {
  goal: Goal;
  balance: number;
  transactions: GoalTransaction[];
  getAccountName: (id: string) => string;
  onArchive: () => void;
  onClose: () => void;
}) {
  const sortedTxs = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1 ${
            goal.type === 'save' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
          }`}>
            {goal.type === 'save' ? 'Apenas Guardar' : 'Investir'}
          </span>
          <h2 className="text-xl font-bold">{goal.title}</h2>
          <p className="text-xs text-muted-foreground">Criado em {fmtDate(goal.createdAt.split('T')[0])}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onArchive} className="h-8 text-xs font-medium">
            <Archive className="h-3.5 w-3.5 mr-1" />
            {goal.status === 'active' ? 'Arquivar' : 'Desarquivar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs text-muted-foreground">Fechar</Button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="finance-card p-4 bg-muted/20 border-border grid grid-cols-2 gap-4">
        <div>
          <span className="text-[11px] text-muted-foreground block">Acumulado</span>
          <span className="text-lg font-bold mono text-success">{fmt(balance)}</span>
        </div>
        <div>
          <span className="text-[11px] text-muted-foreground block">Alvo Objetivo</span>
          <span className="text-lg font-bold mono">{fmt(goal.targetAmount)}</span>
        </div>
        <div className="col-span-2">
          <div className="flex justify-between text-xs mb-1">
            <span>Progresso da Meta</span>
            <span className="font-semibold">{Math.round(goal.targetAmount > 0 ? (balance / goal.targetAmount) * 100 : 0)}%</span>
          </div>
          <Progress value={goal.targetAmount > 0 ? (balance / goal.targetAmount) * 100 : 0} className="h-2" />
        </div>
      </div>

      {/* Meta Specifications */}
      <div className="grid grid-cols-2 gap-3 text-xs border-b border-border pb-4">
        <div>
          <span className="text-muted-foreground">Prazo final em meses:</span>{' '}
          <span className="font-semibold">{goal.deadlineMonths} meses</span>
        </div>
        {goal.type === 'invest' && (
          <div>
            <span className="text-muted-foreground">Rendimento simulado:</span>{' '}
            <span className="font-semibold">{goal.estimatedYield}% a.m.</span>
          </div>
        )}
        {goal.autoDeposit && (
          <div className="col-span-2 mt-1 bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10">
            <span className="font-medium text-indigo-500">Aporte Automático mensal agendado:</span>{' '}
            <span className="font-semibold">{fmt(goal.autoDepositAmount)} todo dia {goal.autoDepositDay} (via conta {getAccountName(goal.accountId || '')})</span>
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold flex items-center gap-1.5">
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          Histórico de Lançamentos
        </h4>
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {sortedTxs.map(t => (
            <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card/50 text-xs">
              <div className="space-y-0.5">
                <span className={`inline-flex items-center gap-1 font-semibold ${t.type === 'deposit' ? 'text-success' : 'text-destructive'}`}>
                  {t.type === 'deposit' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {t.type === 'deposit' ? 'Aporte' : 'Resgate'}
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Via conta <b>{getAccountName(t.accountId || '')}</b> · {fmtDate(t.date)}
                </p>
              </div>
              <span className="mono font-bold text-sm">
                {t.type === 'deposit' ? '+' : '-'}{fmt(t.amount)}
              </span>
            </div>
          ))}
          {sortedTxs.length === 0 && (
            <p className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">Sem aportes ou resgates efetuados nesta meta</p>
          )}
        </div>
      </div>
    </div>
  );
}
