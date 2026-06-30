-- Add interest and discount fields to receivables and payables
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS interest_amount NUMERIC DEFAULT 0;
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS interest_amount NUMERIC DEFAULT 0;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- Add discount field to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
