# Tasks

- [x] Task 1: Fix EasyBuy Payment (Admin Context)
  - [x] SubTask 1.1: Modify `components/easybuy/record-payment-modal.tsx` to fetch current user via `/api/auth/me` instead of `getStaffSession`.
  - [x] SubTask 1.2: Modify `app/api/easybuy/payments/route.ts` to make `processed_by` optional and improve `resolveStaffUuid` logic.

- [x] Task 2: Fix Purchase History & Waterfall Logic
  - [x] SubTask 2.1: Update `app/api/easybuy/payments/route.ts` to correctly implement waterfall payment logic (updating `remaining_balance` and `status`).
  - [x] SubTask 2.2: Update `components/easybuy/purchase-history-tab.tsx` to display correct columns and fetch fresh data from API.
  - [x] SubTask 2.3: Verify `components/easybuy/customer-detail-view.tsx` refreshes data after payment.

- [x] Task 3: Remove Staff Portal from Navbar
  - [x] SubTask 3.1: Remove "Staff Portal" link from `components/ecommerce/navbar.tsx`.
  - [x] SubTask 3.2: Search for and remove any other links to `/pos`, `/admin`, `/investor` in `components/ecommerce/`.

- [x] Task 4: Simplify POS Login UI
  - [x] SubTask 4.1: Rewrite `components/pos/pos-login.tsx` to use simple text/password inputs and remove the keypad.

- [x] Task 5: Enhance Order Confirmation
  - [x] SubTask 5.1: Add "Already have an account? Sign In" button to `components/ecommerce/payment-callback-content.tsx`.
  - [x] SubTask 5.2: Create `lib/whatsapp.ts` (if needed) and add WhatsApp button to `components/ecommerce/payment-callback-content.tsx`.

- [x] Task 6: Fix Customer Signup/Login
  - [x] SubTask 6.1: Update `app/api/auth/register/route.ts` to use `email_confirm: true` and ensure customer linking.
  - [x] SubTask 6.2: Verify `app/api/auth/login/route.ts` works as expected.

- [x] Task 7: POS Loading State
  - [x] SubTask 7.1: Add `authChecking` state and loading spinner to `app/pos/page.tsx`.
  - [x] SubTask 7.2: Apply similar loading state to `app/admin/page.tsx` and `app/investor/page.tsx` if needed.

- [x] Task 8: Readable Audit Logs
  - [x] SubTask 8.1: Modify `components/admin/audit-log-page.tsx` to parse JSON logs and display human-readable changes.

- [x] Task 9: Simplified Staff Creation
  - [x] SubTask 9.1: Locate staff creation form (in `components/admin/settings-page.tsx` or similar) and simplify fields (Staff ID, PIN, Role only).
  - [x] SubTask 9.2: Update `app/api/staff/route.ts` to support simplified creation logic.

- [x] Task 10: Admin Order Quantity Edit
  - [x] SubTask 10.1: Add edit modal to `components/admin/orders-page.tsx` for modifying item quantities.
  - [x] SubTask 10.2: Update `app/api/orders/[id]/route.ts` to handle quantity updates, recalculate totals, and adjust stock.
