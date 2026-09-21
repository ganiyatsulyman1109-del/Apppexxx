# Apex Fixes Batch 4 Spec

## Why
Address critical bugs and UI issues reported in "PROMPT BATCH 4", including payment failures, login issues, staff ID formatting, and UI glitches.

## What Changes

### 1. EasyBuy Payment Fails
- **Modify** `app/api/easybuy/payments/route.ts`:
  - Update `resolvedProcessedBy` logic to fallback to `authResult.user?.id` or `authResult.staff?.id`.
  - Remove the hard stop check `if (!resolvedProcessedBy)`.
- **Database**: Ensure `easybuy_payments.processed_by` column is nullable.

### 2. Investor Login Fails
- **Modify** `app/api/investors/route.ts` (POST):
  - Use the password provided in the request body instead of generating a random one.
  - Return the password in the response (tempPassword).
- **Modify** `app/api/investors/[id]/route.ts` (PUT):
  - Handle password updates when admin edits an investor.
- **Verify**: `components/investor/investor-login.tsx` already uses `createBrowserSupabaseClient` (Confirmed).

### 3. Staff ID Format
- **Modify** `app/api/staff/route.ts`:
  - Change `padStart(4, '0')` to `padStart(3, '0')` for Staff ID generation (e.g., STAFF006).
- **Database**: Run SQL to fix existing Staff IDs to match the new format.

### 4. Staff PIN Digits
- **Modify** `app/api/staff/route.ts`:
  - Change PIN validation to require exactly 4 digits (remove 4-6 range).
- **Modify** `components/admin/settings-page.tsx`:
  - Update PIN input `maxLength` to 4.
  - Update validation logic.

### 5. Staff Login Fails (After New Add)
- **Modify** `app/api/staff/route.ts`:
  - Ensure PIN is converted to string before hashing.
- **Modify** `components/admin/settings-page.tsx`:
  - Ensure PIN is sent as a string in the payload.

### 6. Investor Revenue Display
- **Modify** `components/admin/dashboard-home.tsx`:
  - Remove the "Investor Obligations" / "Net Revenue" cards.
- **Modify** `components/admin/investors-page.tsx`:
  - Add the Revenue/Obligations/Net Revenue cards at the top.
  - Fetch total revenue data.

### 7. POS Data Flash
- **Modify** `app/pos/page.tsx`:
  - Add `authChecking` state to show a loading spinner while checking authentication.
- **Modify** `components/easybuy/easybuy-dashboard.tsx`:
  - Ensure loading skeleton is shown during initial data fetch.

## Impact
- **EasyBuy**: Payments should work reliably for both staff and admin.
- **Investors**: Account creation and login will work as expected.
- **Staff**: IDs will be consistent, PINs will be standard 4 digits, and login will work immediately after creation.
- **UI**: Better organization of investor data and smoother POS loading experience.
