# Plan: Critical Fixes 7–12 (No New Features, Confirmed Bugs Only)

## Operating constraints
- Fix only confirmed broken behavior listed in this request.
- Do not add new features or unrelated refactors.
- Read each target file fully before any edit.
- Use MCP checks to confirm database/storage state before and after each critical fix.
- Preserve existing auth guards and page structures unless required to fix visibility/functionality.

## Global implementation pattern
1. Keep existing auth check at top of route/component flow.
2. For admin/staff data routes, ensure DB queries use the intended privileged client path already established in project conventions.
3. Keep response contracts stable to avoid frontend breakage.
4. For upload failures requested as non-blocking, degrade gracefully and continue primary workflow.

---

## Phase 1 — Baseline reads and state verification (read-only first)

### 1.1 Read files completely before editing
- Admin navigation/page composition:
  - `components/admin/admin-dashboard.tsx` (or actual admin shell)
  - `components/admin/admin-sidebar.tsx` (or equivalent nav definition)
  - `components/admin/settings-page.tsx`
- Staff routes/components:
  - `app/api/staff/route.ts`
  - `app/api/staff/[id]/route.ts`
  - staff management UI component(s) if separate
- EasyBuy upload flow:
  - `lib/storage.ts`
  - `components/easybuy/register-customer-modal.tsx`
- Analytics/POS:
  - `app/api/analytics/dashboard/route.ts`
  - `app/api/analytics/revenue/route.ts`
  - `app/api/analytics/customers/route.ts`
  - `components/pos/today-stats.tsx` (or actual stats component)
  - `app/api/pos/daily-stats/route.ts`
  - `app/api/pos/sales/route.ts`
- Env usage:
  - `lib/email.ts`
  - `app/api/payments/initialize/route.ts`
  - `lib/utils/supabase.ts`

### 1.2 MCP baseline queries
- `SELECT staff_id, full_name, role, is_active FROM staff ORDER BY created_at;`
- `SELECT COUNT(*) FROM orders WHERE status != 'cancelled';`
- `SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid';`
- `SELECT COUNT(*) FROM customers;`
- `SELECT COUNT(*) FROM products WHERE is_active = true AND stock <= COALESCE(threshold, 10);`
- `SELECT COUNT(*) FROM orders;`
- `SELECT COUNT(*) FROM orders WHERE source='pos';`
- `SELECT COUNT(*) FROM staff;`
- `SELECT COUNT(*) FROM investors;`
- `SELECT id, name, public FROM storage.buckets;`
- For bucket policies:
  - Primary requested query: `SELECT name, definition FROM storage.policies WHERE bucket_id = 'customer-photos';`
  - If unavailable in project schema, fallback to `pg_policies` query filtered to `storage.objects` and `customer-photos`.

---

## Phase 2 — Critical Fix 7: Staff Management visibility/functionality

### 2.1 Diagnose placement/visibility
- Confirm whether Staff Management is:
  - a dedicated admin nav item/page, or
  - nested under Settings tab/section.
- If hidden due to tab logic, fix tab state/render condition.
- If absent from nav, add nav entry pointing to existing staff management view/component.

### 2.2 Functional checks against requirements
- Ensure UI presents:
  - staff list (`staff_id`, `full_name`, `role`, `is_active`)
  - add staff action (modal/form)
  - fields `full_name`, `role`, `PIN (4–6 digits)`
  - edit action
  - active/inactive toggle
- Validate backend endpoints used by that UI:
  - `GET /api/staff` returns full list for admin
  - `PUT /api/staff/[id]` updates record correctly

---

## Phase 3 — Critical Fix 8: EasyBuy customer photo upload (non-blocking)

### 3.1 Policy verification/fix
- Check `customer-photos` bucket policies via MCP.
- Add missing policies:
  - INSERT for authenticated on `customer-photos`
  - SELECT public read on `customer-photos`

### 3.2 Upload behavior fix in UI flow
- In registration modal:
  - keep photo optional
  - if upload fails, set `photo_url = null` and continue registration
  - show warning message for upload failure
  - do not block overall customer registration

### 3.3 Storage client check
- Confirm `uploadCustomerPhoto` uses authenticated client context in current architecture.

---

## Phase 4 — Critical Fix 9: Admin dashboard metrics accuracy

### 4.1 Route query audit
- Document exact `dashboard` route queries currently used.
- Compare with manual MCP query outputs requested by user.

### 4.2 Privileged client correction
- Ensure:
  - `app/api/analytics/dashboard/route.ts`
  - `app/api/analytics/revenue/route.ts`
  - `app/api/analytics/customers/route.ts`
  perform queries via admin client so admin sees complete data set.

### 4.3 Consistency checks
- Ensure metric definitions in route align with displayed labels in UI.

---

## Phase 5 — Critical Fix 10: POS recent sales/today stats empty

### 5.1 End-to-end trace
- Confirm POS UI endpoints used for:
  - today stats
  - recent sales
- Verify route auth path uses `requireStaffOrAdminAuth`.

### 5.2 Query-client correction
- Ensure all DB queries inside `app/api/pos/daily-stats/route.ts` and `app/api/pos/sales/route.ts` use `authResult.supabase` (not a separately created less-privileged client).
- Ensure payload/response shapes still match POS components.

---

## Phase 6 — Critical Fix 11: Environment variable usage and callback fallback

### 6.1 Audit and correctness
- Validate usage patterns for:
  - `RESEND_API_KEY`
  - `ADMIN_EMAIL`
  - `NEXT_PUBLIC_SITE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 6.2 Initialize callback fallback adjustment
- In `app/api/payments/initialize/route.ts`, adjust callback URL resolution to prioritize:
  - `process.env.URL`
  - then `process.env.NEXT_PUBLIC_SITE_URL`
  - then safe runtime origin fallback if required by existing code path
- Remove placeholder-domain dependence.

---

## Phase 7 — Critical Fix 12: Missing admin navigation items

### 7.1 Nav completeness
- Verify sidebar/nav includes and correctly routes to:
  - Dashboard
  - Orders
  - Products
  - Inventory
  - EasyBuy
  - Investors
  - Analytics
  - Staff Management
  - Settings
  - Notifications

### 7.2 Correct mapping
- Ensure each nav item targets existing page/component route and is visible to admin role.

---

## Phase 8 — Validation and reporting

### 8.1 Build validation
- Run `pnpm build`.
- Capture exact output text (including warnings/errors and final status).

### 8.2 MCP final verification queries
- `SELECT COUNT(*) FROM orders;`
- `SELECT COUNT(*) FROM orders WHERE source='pos';`
- `SELECT COUNT(*) FROM staff;`
- `SELECT COUNT(*) FROM investors;`
- `SELECT id, name, public FROM storage.buckets;`
- Re-run staff list and analytics comparison queries where relevant.

### 8.3 Final delivery format
- List every changed file (complete list).
- For each file, summarize exact fix applied.
- List anything not fixable in code and explain why.
- Flag any required manual actions in Supabase dashboard / Netlify / Vercel.

---

## Completion criteria
- Staff Management is visible and functional from admin navigation.
- EasyBuy registration no longer fails when customer photo upload fails.
- Analytics and POS endpoints return complete/accurate admin-visible data.
- Env fallback logic for payment callback is deployment-safe.
- Required navigation items are present and reachable.
- Build result and MCP outputs are provided exactly as requested.
