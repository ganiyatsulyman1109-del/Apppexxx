CREATE OR REPLACE FUNCTION public.generate_order_number(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'Business ID is required to generate an order number';
  END IF;

  RETURN public.generate_order_number();
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_order_number(uuid) TO service_role;
