CREATE OR REPLACE FUNCTION public.decrement_account_balance(p_account_id uuid, p_amount numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.financial_accounts
  SET balance = balance - p_amount
  WHERE id = p_account_id;
$$;