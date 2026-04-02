ALTER TABLE public.financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_type_check;

ALTER TABLE public.financial_accounts ADD CONSTRAINT financial_accounts_type_check CHECK (
  type <> ''
  AND type ~ '^(checking|savings|cash|credit_card)(,(checking|savings|cash|credit_card))*$'
);