# Fixes Batch 3 Spec

## Why
This spec addresses 10 critical fixes and improvements requested to stabilize the EasyBuy, Admin, POS, and Ecommerce flows. These range from fixing payment failures in admin context to simplifying login UIs and improving audit log readability.

## What Changes

### FIX 1: EasyBuy Payment (Admin Context)
- **Modify**: `components/easybuy/record-payment-modal.tsx` to remove `getStaffSession` and fetch current user via `/api/auth/me`.
- **Modify**: `app/api/easybuy/payments/route.ts` to make `processed_by` optional and improve staff ID resolution.

### FIX 2: Purchase History & Waterfall Logic
- **Modify**: `app/api/easybuy/payments/route.ts` to correctly update `remaining_balance` and `status` for purchases using waterfall logic.
- **Modify**: `components/easybuy/purchase-history-tab.tsx` to display fresh data (purchase date, total amount, remaining balance, status) and fetch from API instead of relying on stale props.
- **Verify**: `components/easybuy/customer-detail-view.tsx` refreshes data after payment.

### FIX 3: Remove Staff Portal from Navbar
- **Remove**: "Staff Portal" link from `components/ecommerce/navbar.tsx` (desktop and mobile).
- **Remove**: Any other links to `/pos`, `/admin`, `/investor` from ecommerce components.

### FIX 4: POS Login UI
- **Modify**: `components/pos/pos-login.tsx` to replace keypad with simple text input for Staff ID and password input for PIN (no eye toggle).

### FIX 5: Order Confirmation Enhancements
- **Modify**: `components/ecommerce/payment-callback-content.tsx` to add "Sign In" button and "Chat on WhatsApp" button on success.

### FIX 6: Customer Signup/Login Fix
- **Modify**: `app/api/auth/register/route.ts` to use `email_confirm: true` when creating user and ensure customer record is linked.
- **Verify**: `app/api/auth/login/route.ts` handles login correctly.

### FIX 7: POS Loading State
- **Modify**: `app/pos/page.tsx` (and potentially `app/admin/page.tsx`, `app/investor/page.tsx`) to show loading spinner while checking auth to prevent flash of login screen.

### FIX 8: Human-Readable Audit Logs
- **Modify**: `components/admin/audit-log-page.tsx` to parse JSON `before_data`/`after_data` into plain English sentences describing changes.

### FIX 9: Simplified Staff Creation
- **Modify**: Staff creation form (likely in `components/admin/settings-page.tsx`) to require only Staff ID, PIN, and Role.
- **Modify**: `app/api/staff/route.ts` to support simplified creation (auto-generate ID if needed, default other fields).

### FIX 10: Admin Order Quantity Edit
- **Modify**: `components/admin/orders-page.tsx` to add edit modal for item quantities.
- **Modify**: `app/api/orders/[id]/route.ts` to handle PATCH requests for item quantities and update stock/totals accordingly.

## Impact
- **EasyBuy**: Admin payments will work; purchase history will be accurate.
- **Ecommerce**: Cleaner navbar; better post-purchase experience; reliable signup/login.
- **POS**: Simplified login; no flash on load.
- **Admin**: Readable logs; easier staff management; order quantity editing.
