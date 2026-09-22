
const { createAdminClient } = require('../lib/utils/supabase');

async function runVerification() {
  const supabase = createAdminClient();

  console.log('--- STAFF CHECK ---');
  const { data: staff } = await supabase.from('staff').select('staff_id, role, is_active').order('created_at');
  console.table(staff);

  console.log('--- INVESTORS CHECK ---');
  const { data: investors } = await supabase.from('investors').select('investor_id, full_name, investment_amount, total_returns_earned, total_returns_paid, current_balance');
  console.table(investors);

  console.log('--- EASYBUY CUSTOMERS CHECK ---');
  const { data: ebCustomers } = await supabase.from('easybuy_customers').select('easybuy_id, full_name, current_debt, total_payments');
  console.table(ebCustomers);

  console.log('--- EASYBUY PURCHASES CHECK ---');
  const { data: ebPurchases } = await supabase.from('easybuy_purchases').select('id, status, remaining_balance, total_amount, purchase_date').order('purchase_date', { ascending: true });
  console.table(ebPurchases);

  console.log('--- PENDING ORDERS CHECK ---');
  const { count: pendingOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  console.log('Pending Orders Count:', pendingOrders);
}

runVerification().catch(console.error);
