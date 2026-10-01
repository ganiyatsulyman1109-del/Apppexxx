DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.staff
    WHERE pin_hash IS NULL
       OR pin_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
  ) THEN
    RAISE EXCEPTION 'Staff PIN migration incomplete: hash all valid legacy PINs and reset invalid/missing PINs before finalizing';
  END IF;
END
$$;

ALTER TABLE public.staff
  ALTER COLUMN staff_id SET NOT NULL,
  ALTER COLUMN full_name SET NOT NULL,
  ALTER COLUMN pin_hash SET NOT NULL,
  DROP COLUMN pin;
