# JOEBEK AUTO-MART — Production Reality Fix Implementation Plan

## Scope Lock
- Do not add new features.
- Change only confirmed broken behavior.
- Ensure end-to-end real data flow: UI -> API -> Supabase -> UI.
- Before each code edit, read the full target file first.
- For every fix, verify with runtime checks and Supabase query evidence.

## Global Execution Rules
1. For each fix area:
   - Read all listed files completely.
   - Trace the exact request/response flow and auth path.
   - Implement only minimal, targeted changes.
   - Add explicit server-side error surfacing where silent failures exist.
   - Validate behavior from UI action through DB persistence.
2. Keep auth and data writes on server routes with admin client where RLS would block required writes.
3. Preserve existing route contracts unless they are the direct source of breakage.
4. After each fix, run focused checks before moving to next fix.

## Fix 1 — EasyBuy Registration: No Staff Session
### Read First
- `app/api/easybuy/customers/route.ts`
- `lib/auth.ts` (`requireStaffOrAdminAuth`)
- `app/actions/get-staff-session.ts`
- `components/easybuy/register-customer-modal.tsx`
- `lib/api-client.ts`

### Implementation Steps
1. Confirm EasyBuy customers route uses `requireStaffOrAdminAuth` and not admin-only auth.
2. In `requireStaffOrAdminAuth`, enforce this auth order:
   - Try `staff-session` cookie validation first.
   - If invalid/missing, try admin JWT session validation.
   - If either succeeds, return authorized context.
3. Normalize cookie retrieval for Next.js server context using `cookies()` consistently.
4. Verify cookie name parity (`staff-session`) across login writer and auth reader.
5. Ensure EasyBuy registration request sends cookies:
   - If via shared API client, confirm `credentials: 'include'`.
   - If direct fetch, add `credentials: 'include'`.
6. Ensure API failure response preserves actionable message for frontend display.

### Verification
- Trace flow: Staff login -> EasyBuy -> Register Customer -> submit.
- Confirm `/api/easybuy/customers` receives staff cookie and passes auth.
- Confirm insert into `easybuy_customers` succeeds and UI refreshes customer list.

## Fix 2 — Post-Payment Customer Account Creation
### Read First
- `components/ecommerce/payment-callback-content.tsx`
- `app/signup/page.tsx` (or actual signup form component)
- `app/api/auth/register/route.ts`
- `app/api/customers/route.ts` (if used)
- `app/account/page.tsx`

### Implementation Steps
1. Verify callback "Create Account" path reaches active signup route.
2. In register API:
   - Confirm `supabase.auth.signUp` creates auth user.
   - Insert customer profile with admin client when RLS could block.
   - Include `user_id`, name, email, and phone when available.
3. Ensure rollback/deletion path uses admin client if cleanup is required.
4. Ensure signup form posts expected payload and handles API errors explicitly.
5. Ensure successful signup signs in user/session and redirects to `/account`.
6. In account data query logic, align order lookup to real linkage:
   - Prefer `customer_id` by authenticated user mapping.
   - Apply email fallback only where schema/path requires it.

### Verification
- Simulate paid guest -> create account.
- Confirm both `auth.users` and `customers` rows are created and linked.
- Confirm `/account` loads real orders for the created customer.

## Fix 3 — All Sales Must Reflect in Admin Panel
### Step 3A: Verify DB Write Path and Silent Failures
#### Read First
- `app/api/orders/route.ts` (POST)
- `lib/order-utils.ts` (`createOrderTransaction`)
- `app/api/payments/verify/route.ts`

#### Implementation Steps
1. Trace POS/ecommerce order insertion path to `orders` table.
2. Add explicit error logging in catch blocks where failures can be swallowed.
3. Ensure each async write is awaited and checked.

#### Verification
- Query counts and latest rows in `orders`.
- Confirm errors surface in server logs when forced failure occurs.

### Step 3B: POS Sales Not Saving
#### Read First
- `components/pos/pos-dashboard.tsx` (sale submit path)
- `lib/api-client.ts` (`createOrder`)
- `app/api/orders/route.ts` (POST)

#### Implementation Steps
1. Validate endpoint/payload used by POS completion.
2. Ensure request includes credentials and route auth is compatible with staff session.
3. Add explicit frontend error handling so failed API does not present success.
4. In orders POST:
   - Use admin client for DB writes.
   - Resolve `staff_id` to UUID before insert.
   - Return exact Supabase error details in non-200 responses.
   - Log received payload and DB response/errors for diagnosis.

#### Verification
- Complete POS sale and confirm row insertion in `orders`.
- Confirm UI shows error when API intentionally fails.

### Step 3C: Ecommerce Orders Not Reflecting
#### Read First
- `app/api/payments/verify/route.ts`
- `lib/order-utils.ts`

#### Implementation Steps
1. Ensure verify route uses admin client for write operations.
2. Ensure `createOrderTransaction` receives correct client/context.
3. In `createOrderTransaction`, throw immediately on:
   - `orders` insert error
   - stock decrement/update error
   - `inventory_logs` insert error
4. Return created order payload to caller and use it to confirm success response.

#### Verification
- Run payment verification flow and confirm ecommerce order appears in DB and response.

### Step 3D: Admin Dashboard Metrics Refresh
#### Read First
- `components/admin/dashboard-home.tsx`
- `app/api/analytics/dashboard/route.ts`

#### Implementation Steps
1. Ensure dashboard analytics route uses admin client and unfiltered admin-safe queries.
2. Add dashboard polling every 30 seconds with cleanup.
3. Correct realtime subscription channel/table/event for `orders` `INSERT`.
4. Trigger full dashboard data refresh on realtime insert event.

#### Verification
- Create new sale and confirm dashboard updates without hard refresh.

### Step 3E: POS Today Stats and Recent Sales
#### Read First
- `components/pos/today-stats.tsx`
- `app/api/pos/daily-stats/route.ts`
- `app/api/pos/sales/route.ts`

#### Implementation Steps
1. Update daily stats query for today POS sales count and sum.
2. Update recent sales route to return latest 10 POS orders with required fields.
3. Ensure stats component fetches on mount and refreshes after successful sale event.

#### Verification
- Make POS sale and confirm immediate update in today stats and recent list.

## Fix 4 — Staff Management Saves to Database
### Read First
- `components/admin/settings-page.tsx` (Users & Roles)
- `app/api/staff/route.ts` (GET/POST)
- `app/api/staff/[id]/route.ts` (PUT)

### Implementation Steps
1. Confirm add/edit/toggle actions hit correct API routes and methods.
2. Ensure staff APIs use admin client for insert/update.
3. Ensure UI refetches staff list after successful add/edit/toggle.
4. Ensure success/error handling reflects actual API outcome.

### Verification
- Add staff -> appears immediately.
- Edit staff -> updates immediately.
- Toggle active state -> persists and reflects in UI.
- Validate with staff table query.

## Fix 5 — Settings Saves to Database
### Read First
- `components/admin/settings-page.tsx`
- `app/api/settings/route.ts` (GET/PUT)

### Implementation Steps
1. Verify settings load from GET on mount into form state.
2. Ensure save calls PUT with full values.
3. Ensure PUT uses admin client and upserts by correct key.
4. Ensure frontend success state only on successful API completion.

### Verification
- Save setting -> value persists in DB.
- Refresh page -> saved value reloads from DB.

## Fix 6 — Analytics and Metrics Accuracy
### Read First
- `app/api/analytics/dashboard/route.ts`
- `app/api/analytics/revenue/route.ts`
- `app/api/analytics/customers/route.ts`
- `components/admin/analytics-page.tsx`

### Implementation Steps
1. Use admin client in all analytics routes.
2. Align metric definitions to required formulas:
   - paid revenue sum
   - non-cancelled order count
   - customer count
   - low stock count
   - recent orders
   - revenue by source
3. Implement revenue time grouping with stable date grouping.
4. Implement customer growth series from real table data.
5. In analytics page, fetch all endpoints on mount and refresh every 60s.

### Verification
- Confirm non-placeholder values render.
- Cross-check dashboard totals against direct DB query values.

## Fix 7 — Inventory Reflects Real Stock
### Read First
- `components/admin/inventory-page.tsx`
- `app/api/inventory/route.ts` (if present)
- `app/api/products/route.ts` (GET)
- `lib/order-utils.ts`

### Implementation Steps
1. Confirm order transaction decrements `products.stock` per line item.
2. Confirm `inventory_logs` row creation for each stock movement.
3. Preserve product active status at zero stock; show out-of-stock via quantity.
4. Ensure inventory UI loads current stock and recent logs from API.
5. Ensure refresh after stock adjustment actions.

### Verification
- Execute sale and confirm stock decrement and inventory log entry.
- Confirm admin inventory reflects updated quantities.

## Final Validation and Reporting
1. Run `pnpm build` and resolve TypeScript/build blockers from changed code.
2. Run and capture exact Supabase query outputs:
   - `SELECT COUNT(*) FROM orders;`
   - `SELECT COUNT(*) FROM orders WHERE source = 'pos';`
   - `SELECT COUNT(*) FROM orders WHERE source = 'ecommerce';`
   - `SELECT COUNT(*) FROM staff;`
   - `SELECT COUNT(*) FROM easybuy_customers;`
   - `SELECT COUNT(*) FROM settings;`
   - `SELECT key, value FROM settings ORDER BY key;`
   - `SELECT id, name, public FROM storage.buckets;`
3. Deliver final report containing:
   - every changed file
   - exact DB verification outputs
   - any unresolved item with exact blocking reason
   - explicit manual actions still required in Supabase/Netlify

## Execution Order
1. Fix 1
2. Fix 2
3. Fix 3A -> 3B -> 3C -> 3D -> 3E
4. Fix 4
5. Fix 5
6. Fix 6
7. Fix 7
8. Final Validation and Report
