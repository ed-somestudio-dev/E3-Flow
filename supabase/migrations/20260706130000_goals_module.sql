-- Create goals table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  deadline_months INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('save', 'invest')),
  estimated_yield NUMERIC(5,2) NOT NULL DEFAULT 0.80,
  auto_deposit BOOLEAN NOT NULL DEFAULT false,
  auto_deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  auto_deposit_day INTEGER,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own goals" ON public.goals;
CREATE POLICY "Users can manage own goals" ON public.goals
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

DROP TRIGGER IF EXISTS update_goals_updated_at ON public.goals;
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Create goal_transactions table
CREATE TABLE IF NOT EXISTS public.goal_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for goal_transactions
ALTER TABLE public.goal_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own goal transactions" ON public.goal_transactions;
CREATE POLICY "Users can manage own goal transactions" ON public.goal_transactions
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);
