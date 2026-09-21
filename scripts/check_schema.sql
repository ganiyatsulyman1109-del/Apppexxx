SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'create_order_with_transaction';

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'order_items';
