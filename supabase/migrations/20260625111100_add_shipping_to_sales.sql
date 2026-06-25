-- Add shipping and tracking fields to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipping_cost numeric(10,2);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS estimated_delivery date;
