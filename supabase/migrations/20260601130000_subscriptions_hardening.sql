-- =========================================================
-- Atualização do schema de assinaturas FluxoPro
-- Idempotente — pode ser executado mais de uma vez
-- =========================================================

-- 1) Garante colunas que vieram na nova migration
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_end_date DATE,
  ADD COLUMN IF NOT EXISTS subscription_cycle TEXT;

-- 2) CHECK constraint no status (cobre Asaas + estado local)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_status_check
      CHECK (subscription_status IN (
        'PENDING','RECEIVED','CONFIRMED','OVERDUE','CANCELLED','INACTIVE','TRIAL'
      ));
  END IF;
END$$;

-- 3) CHECK constraint no ciclo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_cycle_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_cycle_check
      CHECK (subscription_cycle IS NULL OR subscription_cycle IN ('MONTHLY','YEARLY','QUARTERLY'));
  END IF;
END$$;

-- 4) Índices para as colunas realmente consultadas
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);                              -- implícito pelo UNIQUE, mas explícito evita ambiguidade
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_asaas_subscription_id
  ON public.subscriptions (asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;                          -- usado no webhook
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_customer_id
  ON public.subscriptions (asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;                              -- usado no checkout
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions (subscription_status);                    -- filtro admin
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end_date
  ON public.subscriptions (trial_end_date)
  WHERE trial_end_date IS NOT NULL;                                 -- busca trials expirando

-- 5) Garante FK para auth.users (já existe na migration base, mas é defensivo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_fkey'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 6) Trigger de updated_at (já existe, mas re-garante)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 7) RLS — habilita e mantém policies existentes
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT: próprio usuário
DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- SELECT: admins
DROP POLICY IF EXISTS "Admins can read all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can read all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- UPDATE: admins (necessário para gestão manual / cancelamento)
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- DELETE: admins
DROP POLICY IF EXISTS "Admins can delete subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can delete subscriptions"
  ON public.subscriptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- INSERT/UPDATE/DELETE pelo próprio usuário continuam bloqueados —
-- escrita deve passar por Edge Function com service_role.

-- 8) Função utilitária: expira trials vencidos (chame via cron ou pg_cron)
CREATE OR REPLACE FUNCTION public.expire_subscription_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.subscriptions
     SET subscription_status = 'OVERDUE',
         updated_at = now()
   WHERE subscription_status = 'TRIAL'
     AND trial_end_date IS NOT NULL
     AND trial_end_date < CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Permite que o owner do banco invoque a função
GRANT EXECUTE ON FUNCTION public.expire_subscription_trials() TO service_role;

-- =========================================================
-- Opcional: agendar a expiração de trials via pg_cron (1x/hora)
-- Descomente se o projeto tiver a extensão pg_cron habilitada.
-- =========================================================
-- SELECT cron.schedule('expire-fluxopro-trials', '0 * * * *',
--   $$SELECT public.expire_subscription_trials()$$);
