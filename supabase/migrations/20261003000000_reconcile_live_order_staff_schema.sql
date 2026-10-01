-- Reconcile the deployed storefront schema with the existing POS, EasyBuy,
-- payment, and staff contracts. This is additive except for widening checks.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS staff_id UUID,
  ADD COLUMN IF NOT EXISTS easybuy_customer_id UUID,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT;

UPDATE public.orders
SET source = CASE channel
  WHEN 'online' THEN 'ecommerce'
  WHEN 'easybuy' THEN 'easybuy'
  WHEN 'pos' THEN 'pos'
  ELSE 'pos'
END
WHERE source IS NULL;

UPDATE public.orders
SET total_amount = total
WHERE total_amount IS NULL;

UPDATE public.orders
SET payment_reference = paystack_reference
WHERE payment_reference IS NULL AND paystack_reference IS NOT NULL;

UPDATE public.orders
SET shipping_amount = COALESCE(delivery_fee, 0)
WHERE shipping_amount IS NULL;

UPDATE public.orders
SET shipping_address = delivery_address
WHERE shipping_address IS NULL AND delivery_address IS NOT NULL;

UPDATE public.orders
SET shipping_city = delivery_city
WHERE shipping_city IS NULL AND delivery_city IS NOT NULL;

ALTER TABLE public.orders
  ALTER COLUMN source SET DEFAULT 'ecommerce',
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN tax_amount SET DEFAULT 0,
  ALTER COLUMN shipping_amount SET DEFAULT 0;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_source_check,
  DROP CONSTRAINT IF EXISTS orders_status_check,
  DROP CONSTRAINT IF EXISTS orders_payment_status_check,
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_source_check
    CHECK (source IN ('ecommerce', 'pos', 'easybuy')) NOT VALID,
  ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'confirmed', 'processing', 'ready', 'out_for_delivery', 'shipped', 'delivered', 'collected', 'cancelled', 'refunded')) NOT VALID,
  ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending', 'awaiting_confirmation', 'confirmed', 'paid', 'failed', 'refunded')) NOT VALID,
  ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'card', 'cash', 'pos', 'easybuy', 'other', 'paystack', 'pos_terminal', 'transfer', 'credit')) NOT VALID;

ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_source_check,
  VALIDATE CONSTRAINT orders_status_check,
  VALIDATE CONSTRAINT orders_payment_status_check,
  VALIDATE CONSTRAINT orders_payment_method_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_staff_id_fkey' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_easybuy_customer_id_fkey' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_easybuy_customer_id_fkey FOREIGN KEY (easybuy_customer_id) REFERENCES public.easybuy_customers(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_staff_id_fkey,
  VALIDATE CONSTRAINT orders_easybuy_customer_id_fkey;

CREATE INDEX IF NOT EXISTS orders_business_source_created_at_idx
  ON public.orders (business_id, source, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_order_compatibility_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.source := COALESCE(
      NEW.source,
      CASE NEW.channel WHEN 'online' THEN 'ecommerce' WHEN 'easybuy' THEN 'easybuy' ELSE 'pos' END
    );
    IF NEW.total_amount IS NULL OR (NEW.total = 0 AND NEW.total_amount <> 0) THEN
      NEW.total := COALESCE(NEW.total_amount, NEW.total);
      NEW.total_amount := NEW.total;
    ELSE
      NEW.total_amount := NEW.total;
    END IF;
    IF NEW.payment_reference IS NULL THEN
      NEW.payment_reference := NEW.paystack_reference;
    ELSIF NEW.paystack_reference IS NULL THEN
      NEW.paystack_reference := NEW.payment_reference;
    ELSIF NEW.payment_reference <> NEW.paystack_reference THEN
      RAISE EXCEPTION 'payment reference aliases must match';
    END IF;
    IF NEW.shipping_address IS NULL THEN
      NEW.shipping_address := NEW.delivery_address;
    ELSIF NEW.delivery_address IS NULL THEN
      NEW.delivery_address := NEW.shipping_address;
    END IF;
    IF NEW.shipping_city IS NULL THEN
      NEW.shipping_city := NEW.delivery_city;
    ELSIF NEW.delivery_city IS NULL THEN
      NEW.delivery_city := NEW.shipping_city;
    END IF;
    IF NEW.shipping_amount IS NULL OR (NEW.shipping_amount = 0 AND COALESCE(NEW.delivery_fee, 0) <> 0) THEN
      NEW.shipping_amount := COALESCE(NEW.delivery_fee, 0);
    ELSIF COALESCE(NEW.delivery_fee, 0) = 0 THEN
      NEW.delivery_fee := NEW.shipping_amount;
    ELSIF NEW.shipping_amount <> NEW.delivery_fee THEN
      RAISE EXCEPTION 'shipping amount aliases must match';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.total IS DISTINCT FROM OLD.total AND NEW.total_amount IS NOT DISTINCT FROM OLD.total_amount THEN
    NEW.total_amount := NEW.total;
  ELSIF NEW.total_amount IS DISTINCT FROM OLD.total_amount AND NEW.total IS NOT DISTINCT FROM OLD.total THEN
    NEW.total := NEW.total_amount;
  ELSIF NEW.total IS DISTINCT FROM NEW.total_amount THEN
    RAISE EXCEPTION 'total and total_amount must match';
  END IF;

  IF NEW.payment_reference IS DISTINCT FROM OLD.payment_reference AND NEW.paystack_reference IS NOT DISTINCT FROM OLD.paystack_reference THEN
    NEW.paystack_reference := NEW.payment_reference;
  ELSIF NEW.paystack_reference IS DISTINCT FROM OLD.paystack_reference AND NEW.payment_reference IS NOT DISTINCT FROM OLD.payment_reference THEN
    NEW.payment_reference := NEW.paystack_reference;
  ELSIF NEW.payment_reference IS DISTINCT FROM NEW.paystack_reference THEN
    RAISE EXCEPTION 'payment reference aliases must match';
  END IF;

  IF NEW.shipping_address IS DISTINCT FROM OLD.shipping_address AND NEW.delivery_address IS NOT DISTINCT FROM OLD.delivery_address THEN
    NEW.delivery_address := NEW.shipping_address;
  ELSIF NEW.delivery_address IS DISTINCT FROM OLD.delivery_address AND NEW.shipping_address IS NOT DISTINCT FROM OLD.shipping_address THEN
    NEW.shipping_address := NEW.delivery_address;
  ELSIF NEW.shipping_address IS DISTINCT FROM NEW.delivery_address THEN
    RAISE EXCEPTION 'shipping address aliases must match';
  END IF;

  IF NEW.shipping_city IS DISTINCT FROM OLD.shipping_city AND NEW.delivery_city IS NOT DISTINCT FROM OLD.delivery_city THEN
    NEW.delivery_city := NEW.shipping_city;
  ELSIF NEW.delivery_city IS DISTINCT FROM OLD.delivery_city AND NEW.shipping_city IS NOT DISTINCT FROM OLD.shipping_city THEN
    NEW.shipping_city := NEW.delivery_city;
  ELSIF NEW.shipping_city IS DISTINCT FROM NEW.delivery_city THEN
    RAISE EXCEPTION 'shipping city aliases must match';
  END IF;

  IF NEW.shipping_amount IS DISTINCT FROM OLD.shipping_amount AND NEW.delivery_fee IS NOT DISTINCT FROM OLD.delivery_fee THEN
    NEW.delivery_fee := NEW.shipping_amount;
  ELSIF NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee AND NEW.shipping_amount IS NOT DISTINCT FROM OLD.shipping_amount THEN
    NEW.shipping_amount := NEW.delivery_fee;
  ELSIF NEW.shipping_amount IS DISTINCT FROM NEW.delivery_fee THEN
    RAISE EXCEPTION 'shipping amount aliases must match';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS orders_sync_compatibility_columns ON public.orders;
CREATE TRIGGER orders_sync_compatibility_columns
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_compatibility_columns();

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS staff_id TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT;

UPDATE public.staff
SET full_name = name
WHERE full_name IS NULL OR btrim(full_name) = '';

UPDATE public.staff
SET staff_id = 'STAFF' || upper(replace(id::text, '-', ''))
WHERE staff_id IS NULL OR btrim(staff_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS staff_staff_id_unique_idx
  ON public.staff (staff_id)
  WHERE staff_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_staff_name_compatibility_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.full_name := COALESCE(NULLIF(btrim(NEW.full_name), ''), NEW.name);
    NEW.name := NEW.full_name;
  ELSIF NEW.full_name IS DISTINCT FROM OLD.full_name AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
    NEW.name := NEW.full_name;
  ELSIF NEW.name IS DISTINCT FROM OLD.name AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name THEN
    NEW.full_name := NEW.name;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS staff_sync_name_compatibility_columns ON public.staff;
CREATE TRIGGER staff_sync_name_compatibility_columns
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_name_compatibility_columns();

ALTER TABLE public.easybuy_customers
  ADD COLUMN IF NOT EXISTS registered_by UUID,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS monthly_income NUMERIC,
  ADD COLUMN IF NOT EXISTS current_debt NUMERIC,
  ADD COLUMN IF NOT EXISTS total_payments NUMERIC,
  ADD COLUMN IF NOT EXISTS last_payment TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_purchase TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'easybuy_customers_registered_by_fkey' AND conrelid = 'public.easybuy_customers'::regclass) THEN
    ALTER TABLE public.easybuy_customers
      ADD CONSTRAINT easybuy_customers_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.easybuy_customers VALIDATE CONSTRAINT easybuy_customers_registered_by_fkey;

UPDATE public.easybuy_customers
SET current_debt = COALESCE(current_debt, outstanding_balance, 0),
    total_payments = COALESCE(total_payments, total_paid, 0);

ALTER TABLE public.easybuy_customers
  ALTER COLUMN current_debt SET DEFAULT 0,
  ALTER COLUMN total_payments SET DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_easybuy_customer_compatibility_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.current_debt := COALESCE(NEW.current_debt, NEW.outstanding_balance, 0);
    NEW.outstanding_balance := NEW.current_debt;
    NEW.total_payments := COALESCE(NEW.total_payments, NEW.total_paid, 0);
    NEW.total_paid := NEW.total_payments;
    RETURN NEW;
  END IF;
  IF NEW.current_debt IS DISTINCT FROM OLD.current_debt AND NEW.outstanding_balance IS NOT DISTINCT FROM OLD.outstanding_balance THEN
    NEW.outstanding_balance := NEW.current_debt;
  ELSIF NEW.outstanding_balance IS DISTINCT FROM OLD.outstanding_balance AND NEW.current_debt IS NOT DISTINCT FROM OLD.current_debt THEN
    NEW.current_debt := NEW.outstanding_balance;
  ELSIF NEW.current_debt IS DISTINCT FROM NEW.outstanding_balance THEN
    RAISE EXCEPTION 'EasyBuy debt aliases must match';
  END IF;
  IF NEW.total_payments IS DISTINCT FROM OLD.total_payments AND NEW.total_paid IS NOT DISTINCT FROM OLD.total_paid THEN
    NEW.total_paid := NEW.total_payments;
  ELSIF NEW.total_paid IS DISTINCT FROM OLD.total_paid AND NEW.total_payments IS NOT DISTINCT FROM OLD.total_payments THEN
    NEW.total_payments := NEW.total_paid;
  ELSIF NEW.total_payments IS DISTINCT FROM NEW.total_paid THEN
    RAISE EXCEPTION 'EasyBuy payment aliases must match';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS easybuy_customers_sync_compatibility_columns ON public.easybuy_customers;
CREATE TRIGGER easybuy_customers_sync_compatibility_columns
  BEFORE INSERT OR UPDATE ON public.easybuy_customers
  FOR EACH ROW EXECUTE FUNCTION public.sync_easybuy_customer_compatibility_columns();

ALTER TABLE public.easybuy_purchases
  ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expected_completion_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_completion_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS quantity INTEGER,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC,
  ADD COLUMN IF NOT EXISTS down_payment NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_plan_months INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_payment NUMERIC,
  ADD COLUMN IF NOT EXISTS processed_by UUID;

UPDATE public.easybuy_purchases
SET remaining_balance = COALESCE(remaining_balance, balance_remaining),
    purchase_date = COALESCE(purchase_date, created_at),
    expected_completion_date = COALESCE(expected_completion_date, due_date),
    down_payment = COALESCE(down_payment, amount_paid, 0);

ALTER TABLE public.easybuy_purchases
  ALTER COLUMN down_payment SET DEFAULT 0;

ALTER TABLE public.easybuy_purchases
  DROP CONSTRAINT IF EXISTS easybuy_purchases_status_check;

ALTER TABLE public.easybuy_purchases
  ADD CONSTRAINT easybuy_purchases_status_check
    CHECK (status IN ('active', 'completed', 'overdue', 'written_off', 'pending', 'partial', 'paid')) NOT VALID;

ALTER TABLE public.easybuy_purchases
  VALIDATE CONSTRAINT easybuy_purchases_status_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'easybuy_purchases_product_id_fkey' AND conrelid = 'public.easybuy_purchases'::regclass) THEN
    ALTER TABLE public.easybuy_purchases
      ADD CONSTRAINT easybuy_purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'easybuy_purchases_processed_by_fkey' AND conrelid = 'public.easybuy_purchases'::regclass) THEN
    ALTER TABLE public.easybuy_purchases
      ADD CONSTRAINT easybuy_purchases_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.easybuy_purchases
  VALIDATE CONSTRAINT easybuy_purchases_product_id_fkey,
  VALIDATE CONSTRAINT easybuy_purchases_processed_by_fkey;

CREATE OR REPLACE FUNCTION public.sync_easybuy_purchase_compatibility_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.remaining_balance := COALESCE(NEW.remaining_balance, NEW.balance_remaining);
    NEW.balance_remaining := NEW.remaining_balance;
    NEW.purchase_date := COALESCE(NEW.purchase_date, NEW.created_at, now());
    NEW.created_at := NEW.purchase_date;
    NEW.expected_completion_date := COALESCE(NEW.expected_completion_date, NEW.due_date);
    NEW.due_date := NEW.expected_completion_date;
    NEW.down_payment := COALESCE(NEW.down_payment, NEW.amount_paid, 0);
    NEW.amount_paid := NEW.down_payment;
    RETURN NEW;
  END IF;
  IF NEW.remaining_balance IS DISTINCT FROM OLD.remaining_balance AND NEW.balance_remaining IS NOT DISTINCT FROM OLD.balance_remaining THEN
    NEW.balance_remaining := NEW.remaining_balance;
  ELSIF NEW.balance_remaining IS DISTINCT FROM OLD.balance_remaining AND NEW.remaining_balance IS NOT DISTINCT FROM OLD.remaining_balance THEN
    NEW.remaining_balance := NEW.balance_remaining;
  ELSIF NEW.remaining_balance IS DISTINCT FROM NEW.balance_remaining THEN
    RAISE EXCEPTION 'EasyBuy balance aliases must match';
  END IF;
  IF NEW.purchase_date IS DISTINCT FROM OLD.purchase_date AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
    NEW.created_at := NEW.purchase_date;
  ELSIF NEW.created_at IS DISTINCT FROM OLD.created_at AND NEW.purchase_date IS NOT DISTINCT FROM OLD.purchase_date THEN
    NEW.purchase_date := NEW.created_at;
  END IF;
  IF NEW.expected_completion_date IS DISTINCT FROM OLD.expected_completion_date AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN
    NEW.due_date := NEW.expected_completion_date;
  ELSIF NEW.due_date IS DISTINCT FROM OLD.due_date AND NEW.expected_completion_date IS NOT DISTINCT FROM OLD.expected_completion_date THEN
    NEW.expected_completion_date := NEW.due_date;
  END IF;
  IF NEW.down_payment IS DISTINCT FROM OLD.down_payment AND NEW.amount_paid IS NOT DISTINCT FROM OLD.amount_paid THEN
    NEW.amount_paid := NEW.down_payment;
  ELSIF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid AND NEW.down_payment IS NOT DISTINCT FROM OLD.down_payment THEN
    NEW.down_payment := NEW.amount_paid;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS easybuy_purchases_sync_compatibility_columns ON public.easybuy_purchases;
CREATE TRIGGER easybuy_purchases_sync_compatibility_columns
  BEFORE INSERT OR UPDATE ON public.easybuy_purchases
  FOR EACH ROW EXECUTE FUNCTION public.sync_easybuy_purchase_compatibility_columns();

ALTER TABLE public.easybuy_payments
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by UUID,
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC;

UPDATE public.easybuy_payments
SET payment_reference = COALESCE(payment_reference, reference),
    payment_date = COALESCE(payment_date, created_at),
    processed_by = COALESCE(processed_by, recorded_by);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'easybuy_payments_processed_by_fkey' AND conrelid = 'public.easybuy_payments'::regclass) THEN
    ALTER TABLE public.easybuy_payments
      ADD CONSTRAINT easybuy_payments_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.easybuy_payments
  VALIDATE CONSTRAINT easybuy_payments_processed_by_fkey;

CREATE OR REPLACE FUNCTION public.sync_easybuy_payment_compatibility_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.payment_reference := COALESCE(NEW.payment_reference, NEW.reference);
    NEW.reference := NEW.payment_reference;
    NEW.payment_date := COALESCE(NEW.payment_date, NEW.created_at, now());
    NEW.created_at := NEW.payment_date;
    NEW.processed_by := COALESCE(NEW.processed_by, NEW.recorded_by);
    NEW.recorded_by := NEW.processed_by;
    RETURN NEW;
  END IF;
  IF NEW.payment_reference IS DISTINCT FROM OLD.payment_reference AND NEW.reference IS NOT DISTINCT FROM OLD.reference THEN
    NEW.reference := NEW.payment_reference;
  ELSIF NEW.reference IS DISTINCT FROM OLD.reference AND NEW.payment_reference IS NOT DISTINCT FROM OLD.payment_reference THEN
    NEW.payment_reference := NEW.reference;
  ELSIF NEW.payment_reference IS DISTINCT FROM NEW.reference THEN
    RAISE EXCEPTION 'EasyBuy payment reference aliases must match';
  END IF;
  IF NEW.payment_date IS DISTINCT FROM OLD.payment_date AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
    NEW.created_at := NEW.payment_date;
  ELSIF NEW.created_at IS DISTINCT FROM OLD.created_at AND NEW.payment_date IS NOT DISTINCT FROM OLD.payment_date THEN
    NEW.payment_date := NEW.created_at;
  END IF;
  IF NEW.processed_by IS DISTINCT FROM OLD.processed_by AND NEW.recorded_by IS NOT DISTINCT FROM OLD.recorded_by THEN
    NEW.recorded_by := NEW.processed_by;
  ELSIF NEW.recorded_by IS DISTINCT FROM OLD.recorded_by AND NEW.processed_by IS NOT DISTINCT FROM OLD.processed_by THEN
    NEW.processed_by := NEW.recorded_by;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS easybuy_payments_sync_compatibility_columns ON public.easybuy_payments;
CREATE TRIGGER easybuy_payments_sync_compatibility_columns
  BEFORE INSERT OR UPDATE ON public.easybuy_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_easybuy_payment_compatibility_columns();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS threshold INTEGER;

UPDATE public.products
SET threshold = COALESCE(threshold, low_stock_threshold, 5)
WHERE threshold IS NULL;

ALTER TABLE public.products
  ALTER COLUMN threshold SET DEFAULT 5;

CREATE OR REPLACE FUNCTION public.sync_product_threshold_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.threshold := COALESCE(NEW.threshold, NEW.low_stock_threshold, 5);
    NEW.low_stock_threshold := NEW.threshold;
  ELSIF NEW.threshold IS DISTINCT FROM OLD.threshold AND NEW.low_stock_threshold IS NOT DISTINCT FROM OLD.low_stock_threshold THEN
    NEW.low_stock_threshold := NEW.threshold;
  ELSIF NEW.low_stock_threshold IS DISTINCT FROM OLD.low_stock_threshold AND NEW.threshold IS NOT DISTINCT FROM OLD.threshold THEN
    NEW.threshold := NEW.low_stock_threshold;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS products_sync_threshold_columns ON public.products;
CREATE TRIGGER products_sync_threshold_columns
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_threshold_columns();

CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_business_id UUID,
  p_items JSONB,
  p_payment_method TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_delivery_type TEXT DEFAULT 'delivery',
  p_delivery_address TEXT DEFAULT NULL,
  p_delivery_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_request RECORD;
  v_product RECORD;
  v_order_items JSONB := '[]'::JSONB;
  v_order public.orders%ROWTYPE;
  v_order_number TEXT;
  v_total NUMERIC(12, 2) := 0;
  v_stock_after INTEGER;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'Business is required';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Order items must be an array';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Non-empty order items are required';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('bank_transfer', 'card') THEN
    RAISE EXCEPTION 'Unsupported storefront payment method';
  END IF;
  IF p_delivery_type IS NULL OR p_delivery_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Unsupported delivery type';
  END IF;
  IF NULLIF(btrim(p_customer_name), '') IS NULL OR NULLIF(btrim(p_customer_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Customer name and phone are required';
  END IF;
  IF p_delivery_type = 'delivery' AND
     (NULLIF(btrim(p_delivery_address), '') IS NULL OR NULLIF(btrim(p_delivery_city), '') IS NULL) THEN
    RAISE EXCEPTION 'Delivery address and city are required';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS entry(item)
    WHERE COALESCE(entry.item->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR COALESCE(entry.item->>'quantity', '') !~ '^[1-9][0-9]{0,3}$'
  ) THEN
    RAISE EXCEPTION 'Each order item requires a valid product ID and quantity';
  END IF;

  PERFORM 1
  FROM public.businesses b
  WHERE b.id = p_business_id
    AND b.is_active IS TRUE
    AND b.is_published IS TRUE
    AND ((p_payment_method = 'bank_transfer' AND b.accept_bank_transfer IS TRUE)
      OR (p_payment_method = 'card' AND b.accept_card_payment IS TRUE));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business is not accepting this payment method';
  END IF;

  FOR v_request IN
    SELECT (entry.item->>'id')::UUID AS product_id,
           SUM((entry.item->>'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS entry(item)
    GROUP BY (entry.item->>'id')::UUID
    ORDER BY (entry.item->>'id')::UUID
  LOOP
    SELECT p.id, p.name, p.price, p.stock, p.images
    INTO v_product
    FROM public.products p
    WHERE p.id = v_request.product_id
      AND p.business_id = p_business_id
      AND p.is_active IS TRUE
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A selected product is unavailable';
    END IF;
    IF COALESCE(v_product.stock, 0) < v_request.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product.name;
    END IF;
    v_total := v_total + (v_product.price * v_request.quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'id', v_product.id,
      'product_id', v_product.id,
      'name', v_product.name,
      'price', v_product.price,
      'quantity', v_request.quantity,
      'image', v_product.images[1]
    ));
  END LOOP;

  v_order_number := 'ORD-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 10));
  INSERT INTO public.orders (
    business_id, order_number, source, channel, items, subtotal, total, payment_method,
    payment_status, status, delivery_type, delivery_address, delivery_city,
    customer_name, customer_phone, customer_email, notes
  )
  VALUES (
    p_business_id, v_order_number, 'ecommerce', 'online', v_order_items, v_total, v_total,
    p_payment_method,
    CASE WHEN p_payment_method = 'bank_transfer' THEN 'awaiting_confirmation' ELSE 'pending' END,
    'pending', p_delivery_type, NULLIF(btrim(p_delivery_address), ''),
    NULLIF(btrim(p_delivery_city), ''), btrim(p_customer_name), btrim(p_customer_phone),
    NULLIF(btrim(p_customer_email), ''), NULLIF(btrim(p_notes), '')
  )
  RETURNING * INTO v_order;

  FOR v_request IN
    SELECT (entry.item->>'id')::UUID AS product_id,
           SUM((entry.item->>'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS entry(item)
    GROUP BY (entry.item->>'id')::UUID
    ORDER BY (entry.item->>'id')::UUID
  LOOP
    UPDATE public.products
    SET stock = stock - v_request.quantity,
        updated_at = now()
    WHERE id = v_request.product_id
      AND business_id = p_business_id
      AND stock >= v_request.quantity
    RETURNING stock INTO v_stock_after;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock changed while placing the order';
    END IF;
    INSERT INTO public.inventory_logs (
      business_id, product_id, type, quantity_change, quantity_before,
      quantity_after, reference, reason
    )
    VALUES (
      p_business_id, v_request.product_id, 'sale', -v_request.quantity,
      v_stock_after + v_request.quantity, v_stock_after,
      v_order.id::TEXT, 'Storefront order ' || v_order.order_number
    );
  END LOOP;

  RETURN to_jsonb(v_order);
END
$$;

CREATE OR REPLACE FUNCTION public.cancel_uninitialized_storefront_card_order(
  p_business_id UUID,
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_stock_before INTEGER;
  v_stock_after INTEGER;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_order.payment_method <> 'card'
     OR v_order.payment_status <> 'pending'
     OR v_order.paystack_reference IS NOT NULL
     OR v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Card order cannot be safely cancelled';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_order.items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    SELECT stock INTO v_stock_before
    FROM public.products
    WHERE id = v_product_id AND business_id = p_business_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unable to restore stock for cancelled card order';
    END IF;
    UPDATE public.products
    SET stock = stock + v_quantity, updated_at = now()
    WHERE id = v_product_id AND business_id = p_business_id
    RETURNING stock INTO v_stock_after;
    INSERT INTO public.inventory_logs (
      business_id, product_id, type, quantity_change, quantity_before,
      quantity_after, reference, reason
    )
    VALUES (
      p_business_id, v_product_id, 'return', v_quantity, v_stock_before,
      v_stock_after, v_order.id::TEXT, 'Restore failed card order ' || v_order.order_number
    );
  END LOOP;

  UPDATE public.orders
  SET status = 'cancelled', payment_status = 'failed', updated_at = now()
  WHERE id = p_order_id AND business_id = p_business_id;
  RETURN TRUE;
END
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_storefront_order(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_uninitialized_storefront_card_order(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_uninitialized_storefront_card_order(UUID, UUID) TO service_role;
