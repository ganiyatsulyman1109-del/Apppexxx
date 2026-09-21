# Tasks

- [x] Task 1: Fix EasyBuy Payment Logic
  - [x] Modify `app/api/easybuy/payments/route.ts` to fix `resolvedProcessedBy` and remove hard stop.
  - [x] Verify `easybuy_payments.processed_by` is nullable (using SQL tool).

- [x] Task 2: Fix Investor Login and Creation
  - [x] Modify `app/api/investors/route.ts` (POST) to use provided password.
  - [x] Modify `app/api/investors/[id]/route.ts` (PUT) to support password updates.

- [x] Task 3: Fix Staff ID Format
  - [x] Modify `app/api/staff/route.ts` to use 3-digit padding for Staff IDs.
  - [x] Run SQL migration to fix existing Staff IDs.

- [x] Task 4: Enforce 4-Digit Staff PIN
  - [x] Modify `app/api/staff/route.ts` validation to exactly 4 digits.
  - [x] Modify `components/admin/settings-page.tsx` PIN input and validation.

- [x] Task 5: Fix Staff Login (PIN Hashing)
  - [x] Modify `app/api/staff/route.ts` to ensure PIN is stringified before hashing.
  - [x] Verify `components/admin/settings-page.tsx` sends PIN as string.

- [x] Task 6: Move Investor Revenue Display
  - [x] Remove investor cards from `components/admin/dashboard-home.tsx`.
  - [x] Add investor revenue cards to `components/admin/investors-page.tsx` with data fetching.

- [x] Task 7: Fix POS Loading Flash
  - [x] Add `authChecking` state to `app/pos/page.tsx`.
  - [x] Verify/Add loading skeleton in `components/easybuy/easybuy-dashboard.tsx`.

- [x] Task 8: Verification
  - [x] Run build to ensure no TypeScript errors.
  - [x] Verify all fixes with code inspection/grep.
