
const { createAdminSupabaseClient } = require('../lib/utils/supabase');

async function runVerification() {
  const supabase = createAdminSupabaseClient();

  console.log('--- CUSTOMERS CHECK ---');
  const { data: customers } = await supabase.from('customers').select('full_name, email, phone, total_orders, total_spent').order('created_at', { ascending: false }).limit(10);
  console.table(customers);

  console.log('--- INVESTORS CHECK ---');
  const { data: investors } = await supabase.from('investors').select('investor_id, full_name, current_balance, total_returns_paid');
  console.table(investors);

  console.log('--- PENDING ORDERS CHECK ---');
  const { count: pendingOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  console.log('Pending Orders Count:', pendingOrders);

  console.log('--- ORDER ITEMS STRUCTURE CHECK ---');
  const { data: orders } = await supabase.from('orders').select('id, order_number, items, total_amount').order('created_at', { ascending: false }).limit(3);
  if (orders && orders.length > 0) {
      console.log(JSON.stringify(orders[0], null, 2));
  } else {
      console.log('No orders found.');
  }
}

runVerification().catch(console.error);
