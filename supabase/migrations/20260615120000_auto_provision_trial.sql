-- Improved Auto-provision TRIAL subscription
-- Upgrades existing PENDING subscriptions to TRIAL if they don't have a trial_end_date

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_end_date DATE;
CREATE OR REPLACE FUNCTION public.auto_provision_trial()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_trial_end DATE;
  v_result json;
  v_existing_status TEXT;
  v_existing_trial_end DATE;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_trial_end := CURRENT_DATE + INTERVAL '14 days';

  -- Check if subscription already exists
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = v_user_id) THEN
    SELECT subscription_status, trial_end_date INTO v_existing_status, v_existing_trial_end
    FROM public.subscriptions
    WHERE user_id = v_user_id;

    -- If it's PENDING and has no trial end date, upgrade it to TRIAL
    IF v_existing_status = 'PENDING' AND v_existing_trial_end IS NULL THEN
      UPDATE public.subscriptions
      SET subscription_status = 'TRIAL',
          trial_end_date = v_trial_end,
          subscription_due_date = v_trial_end,
          updated_at = now()
      WHERE user_id = v_user_id;
    END IF;

    -- Return the subscription
    SELECT row_to_json(s) INTO v_result
    FROM public.subscriptions s
    WHERE s.user_id = v_user_id;
    RETURN v_result;
  END IF;

  -- Insert new trial subscription
  INSERT INTO public.subscriptions (
    user_id,
    subscription_status,
    subscription_plan,
    trial_end_date,
    subscription_due_date
  ) VALUES (
    v_user_id,
    'TRIAL',
    'monthly',
    v_trial_end,
    v_trial_end
  );

  -- Return the newly created subscription
  SELECT row_to_json(s) INTO v_result
  FROM public.subscriptions s
  WHERE s.user_id = v_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_provision_trial() TO authenticated;
