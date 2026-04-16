ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS recurring boolean DEFAULT false;
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS recurrence_frequency text;
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS recurrence_end_date date;