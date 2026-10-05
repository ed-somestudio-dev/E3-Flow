-- =========================================================
-- Concede plano VITALÍCIO ao usuário erixx0147@gmail.com
-- Idempotente — pode ser executado mais de uma vez
-- =========================================================

-- 1) Garante que a constraint de ciclo aceita LIFETIME
--    (a versão original só permitia MONTHLY/YEARLY/QUARTERLY)
--    Existem DUAS constraints antigas: a nomeada (hardening) e a auto-gerada
--    pelo CHECK inline da migration 20260601120000_subscription_trial.sql
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_subscription_cycle_check;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_cycle_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_cycle_check
  CHECK (subscription_cycle IS NULL OR subscription_cycle IN ('MONTHLY','YEARLY','QUARTERLY','LIFETIME'));

-- 2) Cria/atualiza a assinatura como vitalícia
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'erixx0147@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário erixx0147@gmail.com não encontrado em auth.users';
  END IF;

  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = v_user_id) THEN
    UPDATE public.subscriptions
       SET subscription_status   = 'CONFIRMED',
           subscription_plan     = 'lifetime',
           subscription_cycle    = 'LIFETIME',
           subscription_due_date = '2099-12-31',
           trial_end_date        = NULL,
           -- Desvincula do Asaas para que nenhum webhook futuro sobrescreva o status
           asaas_subscription_id = NULL,
           updated_at            = now()
     WHERE user_id = v_user_id;
  ELSE
    INSERT INTO public.subscriptions (
      user_id, subscription_status, subscription_plan,
      subscription_cycle, subscription_due_date, trial_end_date
    ) VALUES (
      v_user_id, 'CONFIRMED', 'lifetime',
      'LIFETIME', '2099-12-31', NULL
    );
  END IF;

  RAISE NOTICE 'Usuário % agora é VITALÍCIO', v_user_id;
END$$;
