# Tasks

- [ ] Task 1: Fix Staff ID Format
  - [ ] Read `app/api/staff/route.ts` completely.
  - [ ] Change `padStart(4, '0')` to `padStart(3, '0')` in generation logic.
  - [ ] Change `padStart(4, '0')` to `padStart(3, '0')` in collision handling loop.
  - [ ] Run SQL migration to fix existing staff IDs: `UPDATE staff SET staff_id = CONCAT('STAFF', LPAD(CAST(REGEXP_REPLACE(staff_id, '[^0-9]', '', 'g') AS INTEGER)::text, 3, '0')) WHERE staff_id LIKE 'STAFF%';`

- [ ] Task 2: Fix Staff PIN Login
  - [ ] Read `app/actions/staff-auth.ts` completely.
  - [ ] Ensure `authenticateStaff` uses `bcrypt.compare(pin, staff.pin_hash)`.
  - [ ] Verify staff fetch includes `staff_id` lookup (try exact, then case-insensitive).
  - [ ] Read `app/api/staff/[id]/route.ts` (or relevant update path).
  - [ ] Ensure PIN updates use `bcrypt.hash(newPin, 10)` before saving.

- [ ] Task 3: Fix Investor Password Unified
  - [ ] Read `app/api/investors/route.ts` POST handler.
  - [ ] Remove server-side password generation.
  - [ ] Use `body.password` to create the auth user.
  - [ ] Return `tempPassword: body.password` in response.
  - [ ] Verify `components/admin/investors-page.tsx` sends password in body.
  - [ ] Read `app/api/investors/[id]/route.ts` PUT handler.
  - [ ] Ensure password updates update the auth user via `adminSupabase.auth.admin.updateUserById`.

- [ ] Task 4: Fix Customer Login Fails After Signup
  - [ ] Read `app/api/auth/login/route.ts`.
  - [ ] Update POST handler to set `sb-access-token` and `sb-refresh-token` cookies on the response.
  - [ ] Read `app/login/page.tsx`.
  - [ ] Update to use `createBrowserSupabaseClient` and `signInWithPassword` directly on the client side (preferred fix).

- [ ] Task 5: Fix Customer Orders Not Showing After Signup
  - [ ] Read `app/api/account/orders/route.ts` (or where orders are fetched).
  - [ ] Fix query to first get `customer.id` from `customers` table using `session.user.id`, then query orders by that `customer_id`.
  - [ ] Read `app/api/auth/register/route.ts`.
  - [ ] Verify/Ensure that when linking a guest customer to a new auth user, the customer record ID is preserved (which preserves order links).

- [ ] Task 6: Fix EasyBuy Payment From Admin Fails
  - [ ] Read `components/easybuy/record-payment-modal.tsx`.
  - [ ] Remove `import { getStaffSession }`.
  - [ ] Replace `getStaffSession` usage with a fetch to `/api/auth/me` (or similar) to get current user ID for `processed_by`.
  - [ ] Read `app/api/easybuy/payments/route.ts`.
  - [ ] Update `resolveStaffUuid` to accept valid UUID strings (admin IDs) directly.

- [ ] Task 7: Fix Pending Orders Accurate
  - [ ] Read `app/api/analytics/dashboard/route.ts`.
  - [ ] Ensure pending orders query counts ALL orders with `status='pending'`.
  - [ ] Read `components/admin/dashboard-home.tsx`.
  - [ ] Add/Verify realtime subscription to `orders` table to refresh dashboard data on change.

- [ ] Task 8: Verification & Build
  - [ ] Run `pnpm build` and fix ALL TypeScript errors.
  - [ ] Verify all fixes using the checklist.
