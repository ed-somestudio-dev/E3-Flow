-- Migration to add image_url column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
