# Apex Enterprise — Production Reality Fix Plan

This plan outlines the steps to fix confirmed broken functionality and ensure real data flows through the application.

## Fix 1: EasyBuy Registration (Staff Session)
**Goal:** Fix "Authentication failed: No staff session found" error.

- [ ] **Review & Analyze**
  - Read `app/api/easybuy/customers/route.ts`
  - Read `lib/auth.ts` (`requireStaffOrAdminAuth`)
  - Read `app/actions/get-staff-session.ts`
  - Read `components/easybuy/register-customer-modal.tsx`

- [ ] **Implementation**
  - Modify `lib/auth.ts`: Update `requireStaffOrAdminAuth` to robustly check for `staff-session` cookie AND fallback to admin JWT. Ensure it handles Next.js 15 `cookies()` correctly.
  - Modify `components/easybuy/register-customer-modal.tsx`: Ensure `apiClient` or `fetch` calls include `credentials: 'include'`.
  - Verify `app/api/easybuy/customers/route.ts` calls the updated auth check correctly.

- [ ] **Verification**
  - Trace registration flow: Staff Login -> EasyBuy -> Register Customer -> Submit.

## Fix 2: Post-Payment Customer Account Creation
**Goal:** Fix customer registration failure after Paystack payment.

- [ ] **Review & Analyze**
  - Read `components/ecommerce/payment-callback-content.tsx`
  - Read `app/signup/page.tsx`
  - Read `app/api/auth/register/route.ts`
  - Read `app/api/customers/route.ts` (if applicable)

- [ ] **Implementation**
  - Modify `app/api/auth/register/route.ts`:
    - Ensure it uses `createAdminClient` for `customers` table insert (bypassing RLS).
    - Ensure `customers` insert includes `user_id` (fix confirmed breakage found in analysis).
    - Fix rollback logic to use admin client if user deletion is needed.
  - Modify `app/signup/page.tsx`: Ensure form submits correctly to the register route.
  - Modify `components/ecommerce/payment-callback-content.tsx`: Ensure it guides user to signup/account correctly.

- [ ] **Verification**
  - Test signup flow after payment.
  - Check `auth.users` and `customers` table in Supabase.

## Fix 3: All Sales Must Reflect in Admin Panel
**Goal:** Ensure orders from POS and Ecommerce appear in Admin.

- [ ] **Step 3A: Verify DB Writes**
  - Audit `app/api/orders/route.ts` (POST).
  - Audit `lib/order-utils.ts` (`createOrderTransaction`).
  - Audit `app/api/payments/verify/route.ts`.
  - Action: Add `console.error` logging to catch blocks.

- [ ] **Step 3B: Fix POS Sales**
  - Modify `components/pos/pos-dashboard.tsx`: Add explicit error handling/display for sale submission.
  - Modify `app/api/orders/route.ts`:
    - Use `createAdminClient`.
    - Fix status assignment (ensure 'completed' is valid or use 'delivered'/'confirmed' based on schema).
    - Log payload and errors.

- [ ] **Step 3C: Fix Ecommerce Orders**
  - Modify `app/api/payments/verify/route.ts`:
    - Ensure `createAdminClient` is used.
    - Ensure `customer_id` handling is robust (fix confirmed breakage regarding null `customer_id`).
  - Modify `lib/order-utils.ts`:
    - Add explicit error throws for table inserts/updates.

- [ ] **Step 3D: Fix Admin Dashboard**
  - Modify `components/admin/dashboard-home.tsx`:
    - Implement `setInterval` (30s) for data refetching.
    - Fix Realtime subscription (channel 'orders', event 'INSERT').
  - Modify `app/api/analytics/dashboard/route.ts`: Ensure it queries `orders` without RLS filtering (admin client).

- [ ] **Step 3E: Fix POS Stats**
  - Modify `app/api/pos/daily-stats/route.ts`: Query correct count/sum for today's POS sales.
  - Modify `app/api/pos/sales/route.ts`: Return recent POS orders.
  - Modify `components/pos/today-stats.tsx`: Refresh stats on mount and after sale.

## Fix 4: Staff Management
**Goal:** Ensure Staff Add/Edit saves to DB.

- [ ] **Review & Analyze**
  - `components/admin/settings-page.tsx`
  - `app/api/staff/route.ts`
  - `app/api/staff/[id]/route.ts`

- [ ] **Implementation**
  - Update API routes to use `createAdminClient`.
  - Update `settings-page.tsx` to refresh list after Add/Edit success.
  - Verify Toggle Active/Inactive functionality.

## Fix 5: Settings Persistence
**Goal:** Ensure Settings save to DB.

- [ ] **Review & Analyze**
  - `components/admin/settings-page.tsx`
  - `app/api/settings/route.ts`

- [ ] **Implementation**
  - Update `app/api/settings/route.ts` (PUT) to use `createAdminClient` and correct upsert logic.
  - Update `settings-page.tsx` to load values on mount.

## Fix 6: Analytics Accuracy
**Goal:** Pull analytics from real DB data.

- [ ] **Review & Analyze**
  - `app/api/analytics/dashboard/route.ts`
  - `app/api/analytics/revenue/route.ts`
  - `app/api/analytics/customers/route.ts`
  - `components/admin/analytics-page.tsx`

- [ ] **Implementation**
  - Update all analytics routes to use `createAdminClient`.
  - Implement correct SQL/Supabase queries for:
    - Total Revenue (`payment_status = 'paid'`)
    - Total Orders, Customers, Low Stock.
    - Revenue over time (grouped by date).
  - Update `analytics-page.tsx` to display real data.

## Fix 7: Inventory Sync
**Goal:** Stock decreases immediately on sale.

- [ ] **Review & Analyze**
  - `components/admin/inventory-page.tsx`
  - `app/api/inventory/route.ts`
  - `app/api/products/route.ts`

- [ ] **Implementation**
  - Verify `createOrderTransaction` handles stock decrement and inventory log.
  - Update `inventory-page.tsx` to fetch fresh data from `api/products` (with stock) and `inventory_logs`.

## Final Verification
- [ ] Run `pnpm build` to check for TS errors.
- [ ] Execute MCP Queries to verify data:
  - `SELECT COUNT(*) FROM orders;`
  - `SELECT COUNT(*) FROM orders WHERE source = 'pos';`
  - `SELECT COUNT(*) FROM orders WHERE source = 'ecommerce';`
  - `SELECT COUNT(*) FROM staff;`
  - `SELECT COUNT(*) FROM easybuy_customers;`
  - `SELECT key, value FROM settings ORDER BY key;`
  - `SELECT id, name, public FROM storage.buckets;`
- [ ] Report changed files and any manual actions needed.
