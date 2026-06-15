UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{full_name}',
  '"Edson"'
)
WHERE email ILIKE 'ed-somestudio@live%' OR email = 'contato@fluxopro.app.br';
