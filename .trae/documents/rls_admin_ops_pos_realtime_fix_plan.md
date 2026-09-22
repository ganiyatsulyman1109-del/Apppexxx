# Plan: RLS, Admin Writes, POS Save, Payment Visibility, and Realtime Reliability Fixes

## Scope and constraints
- Fix only confirmed broken behavior listed in the request.
- Do not introduce unrelated features or structural refactors.
- Read each target file fully before editing.
- Use MCP SQL checks to confirm database/storage state before and after fixes.
- Keep current auth guard behavior (`requireAuth` / `requireStaffOrAdminAuth`) intact.

## Global implementation rule (applies to all write routes)
1. Keep auth/role verification at the top using regular server client and existing auth helper.
2. Instantiate `createAdminClient` in each route that performs writes.
3. Execute all write-side DB operations (`INSERT/UPDATE/DELETE`, including dependent writes) through admin client.
4. Preserve existing response format and validation logic unless directly required to fix confirmed failure.

---

## Phase 1 — Baseline read + root-cause confirmation

### 1.1 Read core auth and client utilities completely
- `lib/auth.ts` (full `requireAuth` and `requireStaffOrAdminAuth` flow)
- `lib/utils/supabase.ts` (server/browser/admin client factories)

### 1.2 Read all target API/UI files completely before edits
- `app/api/products/route.ts`
- `app/api/products/[id]/route.ts`
- `app/api/products/[id]/stock/route.ts`
- `app/api/investors/route.ts`
- `app/api/investors/[id]/route.ts`
- `app/api/investors/[id]/status/route.ts`
- `app/api/orders/[id]/status/route.ts`
- `app/api/staff/route.ts`
- `app/api/staff/[id]/route.ts`
- `app/api/settings/route.ts`
- `app/api/notifications/route.ts`
- `app/api/easybuy/customers/route.ts`
- `app/api/easybuy/purchases/route.ts`
- `app/api/easybuy/payments/route.ts`
- `app/api/payments/verify/route.ts`
- `app/api/payments/webhook/route.ts`
- `app/api/payments/initialize/route.ts`
- `app/api/orders/route.ts`
- `app/api/pos/sales/route.ts` (if present)
- `lib/order-utils.ts`
- `lib/storage.ts`
- `components/admin/product-modal.tsx`
- `components/pos/pos-dashboard.tsx`
- `components/admin/dashboard-home.tsx`
- `components/admin/orders-page.tsx`
- `components/admin/admin-header.tsx`

### 1.3 MCP baseline state checks (read-only)
- `SELECT COUNT(*) FROM orders WHERE source='pos';`
- `SELECT order_number, source, status, payment_status, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 5;`
- `SELECT * FROM storage.policies WHERE bucket_id = 'product-images';`
- `SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'investors' ORDER BY ordinal_position;`

---

## Phase 2 — Critical Fix 1: RLS blocking admin write operations

### 2.1 Apply admin-write pattern route-by-route
- For each listed write handler, keep auth checks as-is, then switch write operations to admin client:
  - `app/api/products/route.ts` (POST)
  - `app/api/products/[id]/route.ts` (PUT, DELETE)
  - `app/api/products/[id]/stock/route.ts`
  - `app/api/investors/route.ts` (POST)
  - `app/api/investors/[id]/route.ts` (PUT)
  - `app/api/investors/[id]/status/route.ts`
  - `app/api/orders/[id]/status/route.ts`
  - `app/api/staff/route.ts` (POST)
  - `app/api/staff/[id]/route.ts` (PUT)
  - `app/api/settings/route.ts` (PUT)
  - `app/api/notifications/route.ts` (POST)
  - `app/api/easybuy/customers/route.ts` (POST)
  - `app/api/easybuy/purchases/route.ts` (POST)
  - `app/api/easybuy/payments/route.ts` (POST)

### 2.2 Safety checks during edits
- Ensure any ancillary writes in same handler also use admin client.
- Ensure no write still runs on regular server client in those handlers.

---

## Phase 3 — Critical Fix 2: Product image upload failure

### 3.1 Storage policy verification and correction via MCP
- Check existing policies for `product-images` bucket.
- If missing required policies, apply:
  - INSERT policy for authenticated uploads.
  - SELECT policy for public reads.

### 3.2 Client/auth flow verification in code
- Confirm `lib/storage.ts` uses authenticated Supabase context for upload path.
- Confirm `components/admin/product-modal.tsx` invokes upload flow with authenticated client/session context.
- If upload path is using unauthenticated client, switch to authenticated browser client in existing architecture.

---

## Phase 4 — Critical Fix 3: Investor creation failing

### 4.1 Route-level correction
- In `app/api/investors/route.ts` POST:
  - Verify `auth.admin.createUser` uses admin client.
  - Verify investor table insert uses admin client.

### 4.2 Schema-to-payload alignment
- Compare insert payload against MCP investors schema output.
- Add any missing non-nullable fields if absent (without altering domain behavior beyond required fields).

---

## Phase 5 — Critical Fix 4: POS sales not saving

### 5.1 End-to-end trace
- Confirm frontend endpoint used by `components/pos/pos-dashboard.tsx`.
- Confirm corresponding API handler auth path and cookie handling.
- Confirm payload shape sent by POS matches expected API schema.

### 5.2 Backend write correctness
- Ensure route handling POS sale uses admin client for writes.
- Verify complete chain in handler:
  1. staff-session auth accepted
  2. order insert with `source='pos'`
  3. stock decrement
  4. inventory log insert
  5. success response payload used by confirmation modal

### 5.3 MCP verification
- Recheck `SELECT COUNT(*) FROM orders WHERE source='pos';` after fixes and test execution.

---

## Phase 6 — Critical Fix 5: Orders not appearing in admin after payment

### 6.1 Verify route/client behavior
- Confirm current `verify` and `webhook` routes use admin client for order creation path.
- Confirm callback URL fallback in initialize route still valid and non-empty behavior is safe.

### 6.2 `createOrderTransaction` consistency
- In `lib/order-utils.ts`, confirm function uses passed client only (no fallback to non-admin inside function).
- Ensure verify/webhook pass admin client when creating ecommerce orders.

### 6.3 MCP verification
- Re-run:
  - `SELECT order_number, source, status, payment_status, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 5;`

---

## Phase 7 — Critical Fix 6: Admin realtime updates reliability

### 7.1 Subscription-client correctness
- Confirm subscriptions in:
  - `components/admin/dashboard-home.tsx`
  - `components/admin/orders-page.tsx`
  - `components/admin/admin-header.tsx`
  use browser Supabase client, not server client.

### 7.2 Channel hygiene
- Ensure unique channel names per component/page scope.
- Ensure cleanup (`removeChannel` / unsubscribe) exists to avoid stale listeners.

---

## Phase 8 — Validation and reporting

### 8.1 Build validation
- Run `pnpm build`.
- Capture exact output including warnings/errors and final status.

### 8.2 Final MCP validation set
- Orders snapshot query (latest 5 orders).
- POS order count query.
- Storage policies query for `product-images`.

### 8.3 Delivery report content
- List each changed file and concise description of what changed.
- Explicitly map each critical fix to the corrected root cause.
- Include exact `pnpm build` result summary.
- Include MCP query outputs requested.

---

## Completion criteria
- Admin write routes no longer fail due to RLS mismatch.
- Product image upload succeeds under corrected policy + auth client flow.
- Investor creation succeeds with admin auth client and schema-complete payload.
- POS sales persist to orders with stock/log side effects.
- Ecommerce payment-created orders appear in admin views.
- Realtime dashboard/order/notification updates use correct client and stable channels.
- Build passes and requested MCP evidence is reported.
