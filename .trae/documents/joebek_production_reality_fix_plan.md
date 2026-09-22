# Apex Enterprise — SURGICAL PRODUCTION FIXES

## 1. Fix `orders_status_check` Constraint Violation
- [ ] **Analyze Constraints**: Use MCP to query `pg_constraint` for `orders` table to find allowed status values.
- [ ] **Audit Code**: Read `lib/order-utils.ts` and `app/api/orders/route.ts` to find all status assignments.
- [ ] **Apply Fixes**: Update `lib/order-utils.ts`, `app/api/orders/route.ts`, `app/api/payments/verify/route.ts`, and `app/api/payments/webhook/route.ts` to use only allowed status values.
- [ ] **Verify**: Insert a test order via MCP with corrected values, then delete it.

## 2. Fix EasyBuy Registration (`guarantor_address` Missing)
- [ ] **Analyze Schema**: Query `information_schema.columns` for `easybuy_customers` to check for `guarantor_address`.
- [ ] **Fix API**: Update `app/api/easybuy/customers/route.ts` to remove `guarantor_address` if missing or add column if needed (decision: align with DB).
- [ ] **Fix Frontend**: Update `components/easybuy/register-customer-modal.tsx` to match the schema.
- [ ] **Verify**: Re-check schema columns via MCP.

## 3. Fix Payment Redirect Failures
- [ ] **Audit Flow**: Read `app/api/payments/initialize/route.ts`, `app/api/payments/verify/route.ts`, and `components/ecommerce/payment-callback-content.tsx`.
- [ ] **Fix Callback URL**: Ensure `initialize` route uses `NEXT_PUBLIC_SITE_URL`.
- [ ] **Fix Verification**: Ensure `verify` route creates order, clears cart, and returns success.
- [ ] **Fix Redirect**: Ensure frontend handles success and redirects to `/payment/success` or shows success UI.

## 4. Fix Admin Dashboard Demo Data
- [ ] **Audit Dashboard**: Read `components/admin/dashboard-home.tsx` and `app/api/analytics/dashboard/route.ts`.
- [ ] **Implement Real Queries**: Update API to query `orders`, `customers`, and `products` tables for real metrics (Revenue, Orders, Customers, Low Stock, Recent Orders).
- [ ] **Remove Mock Data**: Clear hardcoded numbers.
- [ ] **Fix Orders Page**: Update `components/admin/orders-page.tsx` and `app/api/orders/route.ts` to fetch real orders.

## 5. Fix Staff Management Saving
- [ ] **Audit Staff Flow**: Read `components/admin/settings-page.tsx`, `app/api/staff/route.ts`, and `app/api/staff/[id]/route.ts`.
- [ ] **Analyze Table**: Query `staff` table schema via MCP.
- [ ] **Fix POST/PUT**: Implement correct validation, password hashing, ID generation, and DB insertion/update in API.
- [ ] **Fix Frontend**: Improve error handling and list refreshing in `settings-page.tsx`.
- [ ] **Verify**: Check `staff` table for new records via MCP.

## 6. Fix Investor Registration
- [ ] **Audit Investor Flow**: Read `components/admin/investors-page.tsx` and `app/api/investors/route.ts`.
- [ ] **Analyze Table**: Query `investors` table schema for required columns.
- [ ] **Fix API**: Ensure all required fields (e.g., `investor_id`, `current_balance`, `status`) are provided in INSERT.
- [ ] **Fix Frontend**: Improve error display.
- [ ] **Verify**: Insert test investor via UI and check DB via MCP.

## 7. Fix Settings Persistence
- [ ] **Audit Settings**: Read `components/admin/settings-page.tsx` and `app/api/settings/route.ts`.
- [ ] **Fix Load**: Ensure frontend maps API response keys to form fields correctly.
- [ ] **Fix Save**: Ensure API upserts settings correctly using `createAdminClient`.
- [ ] **Verify**: Change a setting, save, reload, and verify persistence.

## 8. Fix POS Sales Display
- [ ] **Audit POS**: Read `components/pos/today-stats.tsx`, `components/pos/recent-sales.tsx`, `app/api/pos/daily-stats/route.ts`, and `app/api/pos/sales/route.ts`.
- [ ] **Implement Refresh**: Ensure `pos-dashboard.tsx` calls refresh methods for stats and sales after a successful transaction.
- [ ] **Fix APIs**: Ensure `daily-stats` and `sales` endpoints return correct aggregated/recent data from DB.

## 9. Final Verification
- [ ] **Build**: Run `pnpm build` and fix any TS errors.
- [ ] **MCP Verification**: Run final SQL queries to confirm schema and data integrity (Constraints, Columns, Staff, Settings, Storage).
- [ ] **Live Test**: Perform end-to-end POS order test via MCP insert/delete if UI is not available, or verify UI flows.
