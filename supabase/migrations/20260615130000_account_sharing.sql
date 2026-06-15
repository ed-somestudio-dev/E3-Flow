-- Tabela para gerenciar membros da família/empresa
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id, member_email),
  UNIQUE(member_email) -- Um email só pode ser convidado para 1 conta
);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Proprietários podem ver os membros que convidaram
CREATE POLICY "Owners can view own family members" ON public.family_members 
  FOR SELECT USING (auth.uid() = owner_id);

-- Proprietários podem adicionar membros (máximo 1)
CREATE POLICY "Owners can add family members" ON public.family_members 
  FOR INSERT WITH CHECK (auth.uid() = owner_id AND (SELECT count(*) FROM public.family_members WHERE owner_id = auth.uid()) < 1);

-- Proprietários podem remover membros
CREATE POLICY "Owners can delete family members" ON public.family_members 
  FOR DELETE USING (auth.uid() = owner_id);

-- Função auxiliar para o RLS descobrir o "tenant" (dono da conta)
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid AS $$
DECLARE
  v_email TEXT;
  v_owner_id UUID;
BEGIN
  -- Tentar pegar o e-mail do JWT (usuários logados)
  v_email := auth.jwt() ->> 'email';
  
  IF v_email IS NULL THEN
    RETURN auth.uid();
  END IF;

  -- Checar se este email foi convidado
  SELECT owner_id INTO v_owner_id
  FROM public.family_members
  WHERE member_email = v_email
  LIMIT 1;

  -- Se for membro, retorna o ID do dono. Se não, retorna o próprio ID.
  IF v_owner_id IS NOT NULL THEN
    RETURN v_owner_id;
  ELSE
    RETURN auth.uid();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Atualizando Políticas RLS para usar o get_tenant_id()
-- Isso permite que o membro (cujo get_tenant_id() retorna o owner_id) acesse os dados do dono.

-- 1. categories
DROP POLICY IF EXISTS "Users can manage own categories" ON public.categories;
CREATE POLICY "Users can manage own categories" ON public.categories 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 2. financial_accounts
DROP POLICY IF EXISTS "Users can manage own accounts" ON public.financial_accounts;
CREATE POLICY "Users can manage own accounts" ON public.financial_accounts 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 3. transactions
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions" ON public.transactions 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 4. payables
DROP POLICY IF EXISTS "Users can manage own payables" ON public.payables;
CREATE POLICY "Users can manage own payables" ON public.payables 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 5. receivables
DROP POLICY IF EXISTS "Users can manage own receivables" ON public.receivables;
CREATE POLICY "Users can manage own receivables" ON public.receivables 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 6. budgets
DROP POLICY IF EXISTS "Users can manage own budgets" ON public.budgets;
CREATE POLICY "Users can manage own budgets" ON public.budgets 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 7. contacts
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
CREATE POLICY "Users can manage own contacts" ON public.contacts 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 8. user_settings
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings" ON public.user_settings 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 9. products
DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "Users manage own products" ON public.products 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 10. sales
DROP POLICY IF EXISTS "Users manage own sales" ON public.sales;
CREATE POLICY "Users manage own sales" ON public.sales 
  FOR ALL USING (public.get_tenant_id() = user_id) WITH CHECK (public.get_tenant_id() = user_id);

-- 11. sale_items (Esta tabela não tem user_id, ela se liga na tabela sales)
DROP POLICY IF EXISTS "Users manage own sale items" ON public.sale_items;
CREATE POLICY "Users manage own sale items" ON public.sale_items 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = public.get_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.user_id = public.get_tenant_id())
  );
