ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS settings_business_id_key_unique
  ON public.settings (business_id, key);

CREATE INDEX IF NOT EXISTS settings_business_id_idx
  ON public.settings (business_id)
  WHERE business_id IS NOT NULL;
