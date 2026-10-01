-- Preserve the investor application contracts while honoring the live
-- principal_amount/return_rate/tenure_months schema.
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN,
  ADD COLUMN IF NOT EXISTS principal_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS total_returns_earned NUMERIC,
  ADD COLUMN IF NOT EXISTS total_returns_paid NUMERIC,
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_return_processed_date DATE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.investors
SET principal_balance = COALESCE(principal_balance, principal_amount),
    total_returns_earned = COALESCE(total_returns_earned, 0),
    total_returns_paid = COALESCE(total_returns_paid, 0),
    current_balance = COALESCE(current_balance, 0),
    is_banned = COALESCE(is_banned, FALSE),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW());

ALTER TABLE public.investors
  ALTER COLUMN is_banned SET DEFAULT FALSE,
  ALTER COLUMN is_banned SET NOT NULL,
  ALTER COLUMN principal_balance SET DEFAULT 0,
  ALTER COLUMN principal_balance SET NOT NULL,
  ALTER COLUMN total_returns_earned SET DEFAULT 0,
  ALTER COLUMN total_returns_earned SET NOT NULL,
  ALTER COLUMN total_returns_paid SET DEFAULT 0,
  ALTER COLUMN total_returns_paid SET NOT NULL,
  ALTER COLUMN current_balance SET DEFAULT 0,
  ALTER COLUMN current_balance SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.investor_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE public.investor_payments
SET status = COALESCE(status, 'paid'),
    created_at = COALESCE(created_at, NOW());

ALTER TABLE public.investor_payments
  ALTER COLUMN status SET DEFAULT 'paid',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

WITH paid_returns AS (
  SELECT investor_id,
         SUM(amount) FILTER (WHERE payment_type IN ('monthly_return', 'bonus')) AS amount_paid,
         MAX(payment_date) AS last_payment
  FROM public.investor_payments
  GROUP BY investor_id
)
UPDATE public.investors AS investor
SET total_returns_paid = COALESCE(paid_returns.amount_paid, 0),
    last_payment_date = paid_returns.last_payment
FROM paid_returns
WHERE paid_returns.investor_id = investor.id;
