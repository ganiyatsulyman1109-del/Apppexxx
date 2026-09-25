CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    subscription_status TEXT NOT NULL DEFAULT 'trial',
    subscription_plan TEXT NOT NULL DEFAULT 'growth',
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    is_onboarded BOOLEAN NOT NULL DEFAULT false,
    is_published BOOLEAN NOT NULL DEFAULT false,
    currency TEXT NOT NULL DEFAULT 'NGN',
    currency_symbol TEXT NOT NULL DEFAULT '₦',
    country TEXT NOT NULL DEFAULT 'Nigeria',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE user_roles
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE user_roles
    DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_role_check
    CHECK (role IN ('admin', 'staff', 'customer', 'investor', 'business_owner'));
ALTER TABLE staff
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE inventory_logs
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE easybuy_customers
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE easybuy_customers
    DROP CONSTRAINT IF EXISTS easybuy_customers_phone_key;
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders
    ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'confirmed', 'awaiting_confirmation'));
ALTER TABLE easybuy_purchases
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE easybuy_purchases
    ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE easybuy_payments
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE investors
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE investors
    ADD COLUMN IF NOT EXISTS tenure_months INTEGER;
ALTER TABLE investor_payments
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS audit_logs
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON profiles(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_business_role_key
    ON user_roles(user_id, business_id, role);
CREATE INDEX IF NOT EXISTS idx_staff_business_id ON staff(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_easybuy_customers_business_id ON easybuy_customers(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS easybuy_customers_business_phone_key
    ON easybuy_customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_easybuy_purchases_business_id ON easybuy_purchases(business_id);
CREATE INDEX IF NOT EXISTS idx_easybuy_purchases_due_date ON easybuy_purchases(business_id, due_date);
CREATE INDEX IF NOT EXISTS idx_easybuy_payments_business_id ON easybuy_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_investors_business_id ON investors(business_id);
CREATE INDEX IF NOT EXISTS idx_investor_payments_business_id ON investor_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_notifications_business_id ON notifications(business_id);
DO $$
BEGIN
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);
    END IF;
END;
$$;

UPDATE profiles p
SET business_id = b.id
FROM businesses b
WHERE p.id = b.owner_id AND p.business_id IS NULL;

UPDATE user_roles ur
SET business_id = p.business_id
FROM profiles p
WHERE ur.user_id = p.id AND ur.business_id IS NULL AND p.business_id IS NOT NULL;

UPDATE customers c
SET business_id = p.business_id
FROM profiles p
WHERE c.user_id = p.id AND c.business_id IS NULL AND p.business_id IS NOT NULL;

UPDATE investors i
SET business_id = p.business_id
FROM profiles p
WHERE i.user_id = p.id AND i.business_id IS NULL AND p.business_id IS NOT NULL;

UPDATE easybuy_customers ec
SET business_id = s.business_id
FROM staff s
WHERE ec.registered_by = s.id AND ec.business_id IS NULL AND s.business_id IS NOT NULL;

UPDATE orders o
SET business_id = c.business_id
FROM customers c
WHERE o.customer_id = c.id AND o.business_id IS NULL AND c.business_id IS NOT NULL;

UPDATE orders o
SET business_id = ec.business_id
FROM easybuy_customers ec
WHERE o.easybuy_customer_id = ec.id AND o.business_id IS NULL AND ec.business_id IS NOT NULL;

UPDATE orders o
SET business_id = s.business_id
FROM staff s
WHERE o.staff_id = s.id AND o.business_id IS NULL AND s.business_id IS NOT NULL;

UPDATE easybuy_purchases ep
SET business_id = ec.business_id
FROM easybuy_customers ec
WHERE ep.easybuy_customer_id = ec.id AND ep.business_id IS NULL AND ec.business_id IS NOT NULL;

UPDATE easybuy_purchases
SET due_date = expected_completion_date
WHERE due_date IS NULL;

CREATE OR REPLACE FUNCTION set_easybuy_purchase_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.due_date := COALESCE(NEW.due_date, NEW.expected_completion_date);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS easybuy_purchase_due_date_trigger ON easybuy_purchases;
CREATE TRIGGER easybuy_purchase_due_date_trigger
BEFORE INSERT OR UPDATE ON easybuy_purchases
FOR EACH ROW
EXECUTE FUNCTION set_easybuy_purchase_due_date();

UPDATE easybuy_payments eyp
SET business_id = ec.business_id
FROM easybuy_customers ec
WHERE eyp.easybuy_customer_id = ec.id AND eyp.business_id IS NULL AND ec.business_id IS NOT NULL;

UPDATE investor_payments ip
SET business_id = i.business_id
FROM investors i
WHERE ip.investor_id = i.id AND ip.business_id IS NULL AND i.business_id IS NOT NULL;

UPDATE inventory_logs il
SET business_id = p.business_id
FROM products p
WHERE il.product_id = p.id AND il.business_id IS NULL AND p.business_id IS NOT NULL;

DO $$
DECLARE
    sole_business_id UUID;
BEGIN
    SELECT (array_agg(id))[1] INTO sole_business_id
    FROM businesses
    HAVING count(*) = 1;

    IF sole_business_id IS NOT NULL THEN
        UPDATE user_roles SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE staff SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE products SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE inventory_logs SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE customers SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE easybuy_customers SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE orders SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE easybuy_purchases SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE easybuy_payments SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE investors SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE investor_payments SET business_id = sole_business_id WHERE business_id IS NULL;
        UPDATE notifications SET business_id = sole_business_id WHERE business_id IS NULL;
        IF to_regclass('public.audit_logs') IS NOT NULL THEN
            UPDATE audit_logs SET business_id = sole_business_id WHERE business_id IS NULL;
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION apply_easybuy_payment(
    p_business_id UUID,
    p_customer_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_order_id UUID DEFAULT NULL,
    p_payment_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_processed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer easybuy_customers%ROWTYPE;
    v_purchase easybuy_purchases%ROWTYPE;
    v_remaining NUMERIC;
    v_payment_amount NUMERIC;
    v_last_purchase_id UUID;
    v_payment easybuy_payments%ROWTYPE;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Service role required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    SELECT * INTO v_customer
    FROM easybuy_customers
    WHERE id = p_customer_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    IF p_amount > v_customer.current_debt THEN
        RAISE EXCEPTION 'Payment amount exceeds current balance';
    END IF;

    v_remaining := p_amount;
    FOR v_purchase IN
        SELECT *
        FROM easybuy_purchases
        WHERE easybuy_customer_id = p_customer_id
          AND business_id = p_business_id
          AND remaining_balance > 0
          AND status IN ('pending', 'partial', 'overdue')
          AND (p_order_id IS NULL OR order_id = p_order_id)
        ORDER BY purchase_date ASC, id ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_payment_amount := LEAST(v_remaining, v_purchase.remaining_balance);
        v_remaining := v_remaining - v_payment_amount;
        v_last_purchase_id := v_purchase.id;

        UPDATE easybuy_purchases
        SET remaining_balance = v_purchase.remaining_balance - v_payment_amount,
            status = CASE
                WHEN v_purchase.remaining_balance - v_payment_amount = 0 THEN 'paid'
                ELSE 'partial'
            END,
            actual_completion_date = CASE
                WHEN v_purchase.remaining_balance - v_payment_amount = 0 THEN now()
                ELSE actual_completion_date
            END,
            updated_at = now()
        WHERE id = v_purchase.id AND business_id = p_business_id;

        IF v_purchase.remaining_balance - v_payment_amount = 0 AND v_purchase.order_id IS NOT NULL THEN
            UPDATE orders
            SET payment_status = 'paid',
                status = 'confirmed',
                updated_at = now()
            WHERE id = v_purchase.order_id
              AND business_id = p_business_id
              AND easybuy_customer_id = p_customer_id;
        END IF;
    END LOOP;

    IF v_remaining > 0 OR v_last_purchase_id IS NULL THEN
        RAISE EXCEPTION 'Payment amount exceeds active purchase balances';
    END IF;

    UPDATE easybuy_customers
    SET current_debt = current_debt - p_amount,
        total_payments = total_payments + p_amount,
        last_payment = now(),
        updated_at = now()
    WHERE id = p_customer_id
      AND business_id = p_business_id
      AND current_debt >= p_amount;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer balance changed concurrently';
    END IF;

    INSERT INTO easybuy_payments (
        business_id,
        easybuy_customer_id,
        easybuy_purchase_id,
        amount,
        payment_method,
        payment_reference,
        notes,
        processed_by,
        payment_date,
        created_at
    )
    VALUES (
        p_business_id,
        p_customer_id,
        v_last_purchase_id,
        p_amount,
        p_payment_method,
        p_payment_reference,
        p_notes,
        p_processed_by,
        now(),
        now()
    )
    RETURNING * INTO v_payment;

    RETURN to_jsonb(v_payment);
END;
$$;

REVOKE ALL ON FUNCTION apply_easybuy_payment(UUID, UUID, NUMERIC, TEXT, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_easybuy_payment(UUID, UUID, NUMERIC, TEXT, UUID, TEXT, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION record_easybuy_credit_purchase(
    p_business_id UUID,
    p_customer_id UUID,
    p_order_id UUID,
    p_items JSONB,
    p_processed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer easybuy_customers%ROWTYPE;
    v_order orders%ROWTYPE;
    v_item RECORD;
    v_product products%ROWTYPE;
    v_product_id UUID;
    v_quantity INTEGER;
    v_unit_price NUMERIC;
    v_total NUMERIC := 0;
    v_purchase easybuy_purchases%ROWTYPE;
    v_purchases JSONB := '[]'::JSONB;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Service role required';
    END IF;
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'At least one purchase item is required';
    END IF;

    SELECT * INTO v_customer
    FROM easybuy_customers
    WHERE id = p_customer_id AND business_id = p_business_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;
    IF v_customer.status <> 'active' THEN
        RAISE EXCEPTION 'Customer account is not active';
    END IF;

    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
      AND business_id = p_business_id
      AND source = 'easybuy'
      AND easybuy_customer_id = p_customer_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order not found';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := COALESCE(v_item.value->>'product_id', v_item.value->>'productId')::UUID;
        v_quantity := (v_item.value->>'quantity')::INTEGER;

        SELECT * INTO v_product
        FROM products
        WHERE id = v_product_id AND business_id = p_business_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Purchase product not found';
        END IF;
        v_unit_price := v_product.price;
        IF v_quantity <= 0 OR v_unit_price <= 0 THEN
            RAISE EXCEPTION 'Purchase item quantity and price must be greater than zero';
        END IF;
        v_total := v_total + (v_quantity * v_unit_price);
    END LOOP;

    IF ABS(v_total - v_order.total_amount) > 0.01 THEN
        RAISE EXCEPTION 'Purchase items do not match order total';
    END IF;
    IF v_customer.current_debt + v_total > v_customer.credit_limit THEN
        RAISE EXCEPTION 'Purchase exceeds credit limit';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := COALESCE(v_item.value->>'product_id', v_item.value->>'productId')::UUID;
        v_quantity := (v_item.value->>'quantity')::INTEGER;
        SELECT * INTO v_product
        FROM products
        WHERE id = v_product_id AND business_id = p_business_id;
        v_unit_price := v_product.price;

        INSERT INTO easybuy_purchases (
            business_id,
            easybuy_customer_id,
            order_id,
            product_id,
            quantity,
            unit_price,
            total_amount,
            down_payment,
            remaining_balance,
            payment_plan_months,
            monthly_payment,
            status,
            processed_by,
            purchase_date,
            expected_completion_date,
            due_date
        )
        VALUES (
            p_business_id,
            p_customer_id,
            p_order_id,
            v_product_id,
            v_quantity,
            v_unit_price,
            v_quantity * v_unit_price,
            0,
            v_quantity * v_unit_price,
            12,
            (v_quantity * v_unit_price) / 12,
            'pending',
            p_processed_by,
            now(),
            now() + interval '365 days',
            now() + interval '365 days'
        )
        RETURNING * INTO v_purchase;
        v_purchases := v_purchases || jsonb_build_array(to_jsonb(v_purchase));
    END LOOP;

    UPDATE easybuy_customers
    SET current_debt = current_debt + v_total,
        total_purchases = total_purchases + v_total,
        last_purchase = now(),
        updated_at = now()
    WHERE id = p_customer_id
      AND business_id = p_business_id;

    RETURN v_purchases;
END;
$$;

REVOKE ALL ON FUNCTION record_easybuy_credit_purchase(UUID, UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_easybuy_credit_purchase(UUID, UUID, UUID, JSONB, UUID) TO service_role;

CREATE OR REPLACE FUNCTION apply_investor_payment(
    p_business_id UUID,
    p_investor_id UUID,
    p_amount NUMERIC,
    p_payment_type TEXT,
    p_payment_method TEXT,
    p_payment_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_processed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_investor investors%ROWTYPE;
    v_payment investor_payments%ROWTYPE;
    v_previous_balance NUMERIC;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'Service role required';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    SELECT * INTO v_investor
    FROM investors
    WHERE id = p_investor_id AND business_id = p_business_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Investor not found';
    END IF;

    v_previous_balance := v_investor.current_balance;
    IF p_amount > v_previous_balance THEN
        RAISE EXCEPTION 'Payment amount exceeds current balance';
    END IF;

    INSERT INTO investor_payments (
        business_id,
        investor_id,
        payment_amount,
        payment_type,
        payment_method,
        payment_reference,
        notes,
        processed_by,
        payment_date,
        created_at
    )
    VALUES (
        p_business_id,
        p_investor_id,
        p_amount,
        p_payment_type,
        p_payment_method,
        p_payment_reference,
        p_notes,
        p_processed_by,
        now(),
        now()
    )
    RETURNING * INTO v_payment;

    UPDATE investors
    SET total_returns_paid = total_returns_paid + p_amount,
        current_balance = current_balance - p_amount,
        last_payment_date = now(),
        updated_at = now()
    WHERE id = p_investor_id
      AND business_id = p_business_id
      AND current_balance >= p_amount
    RETURNING * INTO v_investor;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Investor balance changed concurrently';
    END IF;

    RETURN jsonb_build_object(
        'payment', to_jsonb(v_payment),
        'investor', to_jsonb(v_investor),
        'previous_balance', v_previous_balance
    );
END;
$$;

REVOKE ALL ON FUNCTION apply_investor_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_investor_payment(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
