ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS receipt_stamp_url TEXT;

-- Storage bucket para carimbos/assinaturas dos usuários
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipt-stamps', 'receipt-stamps', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
CREATE POLICY "Stamps são publicamente visíveis"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipt-stamps');

CREATE POLICY "Usuários podem enviar seu próprio carimbo"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipt-stamps' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem atualizar seu próprio carimbo"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipt-stamps' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem remover seu próprio carimbo"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipt-stamps' AND auth.uid()::text = (storage.foldername(name))[1]);