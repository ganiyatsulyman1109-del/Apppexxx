ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

NOTIFY pgrst, 'reload schema';
