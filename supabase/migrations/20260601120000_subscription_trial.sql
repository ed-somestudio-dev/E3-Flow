-- Adiciona período de teste (trial) de 14 dias às assinaturas
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_end_date DATE,
  ADD COLUMN IF NOT EXISTS subscription_cycle TEXT CHECK (subscription_cycle IN ('MONTHLY', 'YEARLY', 'QUARTERLY'));
