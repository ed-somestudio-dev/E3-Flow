-- Add address and cep fields to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS cep text;
