CREATE OR REPLACE FUNCTION public.get_admin_subscriptions()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  subscription_status TEXT,
  subscription_plan TEXT,
  subscription_due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Verify if the caller is an admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    u.email::TEXT as user_email,
    (COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'Usuário'))::TEXT as user_name,
    s.subscription_status,
    s.subscription_plan,
    s.subscription_due_date,
    s.created_at
  FROM public.subscriptions s
  JOIN auth.users u ON s.user_id = u.id
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
