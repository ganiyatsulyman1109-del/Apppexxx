# Tasks

- [ ] Task 1: Phase 1 - MCP Data Verification
  - [ ] SubTask 1.1: Run SQL queries to verify `audit_logs` table and other data counts.

- [ ] Task 2: Phase 2 - Code Pattern Verification
  - [ ] SubTask 2.1: Grep for `getStaffSession` in components (Fix if found).
  - [ ] SubTask 2.2: Grep for `processed_by: 'admin'` (Fix if found).
  - [ ] SubTask 2.3: Grep for `requireAuth` in `app/api/` (Fix if found).
  - [ ] SubTask 2.4: Grep for `payment_status` in `app/api/easybuy/` (Fix if found).
  - [ ] SubTask 2.5: Grep for `getStaffSession` in `app/api/` (Fix if found).

- [ ] Task 3: Check 1 - Audit Table and Helper
  - [ ] SubTask 3.1: Verify `audit_logs` schema (already done in Task 1).
  - [ ] SubTask 3.2: Read and verify `lib/audit.ts`.

- [ ] Task 4: Check 2 - EasyBuy Payment from Admin
  - [ ] SubTask 4.1: Verify `components/easybuy/record-payment-modal.tsx`.
  - [ ] SubTask 4.2: Verify `app/api/easybuy/payments/route.ts`.

- [ ] Task 5: Check 3 - Purchase History
  - [ ] SubTask 5.1: Verify `app/api/easybuy/customers/[id]/route.ts` (Parallel queries).
  - [ ] SubTask 5.2: Verify `components/easybuy/purchase-history-tab.tsx`.
  - [ ] SubTask 5.3: Verify `components/easybuy/payment-history-tab.tsx`.
  - [ ] SubTask 5.4: Verify `components/easybuy/customer-detail-view.tsx` (Realtime).

- [ ] Task 6: Check 4 - Investor Payment
  - [ ] SubTask 6.1: Verify `components/admin/investors-page.tsx`.
  - [ ] SubTask 6.2: Verify `components/admin/record-investor-payment-modal.tsx`.
  - [ ] SubTask 6.3: Verify `app/api/investors/[id]/payments/route.ts`.
  - [ ] SubTask 6.4: Verify `app/api/investors/route.ts` (Accumulation logic).

- [ ] Task 7: Check 5 - Order Edit and Delete
  - [ ] SubTask 7.1: Verify `app/api/orders/[id]/route.ts`.
  - [ ] SubTask 7.2: Verify `components/admin/orders-page.tsx`.

- [ ] Task 8: Check 6 - Audit Log Page
  - [ ] SubTask 8.1: Verify `app/api/admin/audit-logs/route.ts`.
  - [ ] SubTask 8.2: Verify `components/admin/admin-sidebar.tsx`.
  - [ ] SubTask 8.3: Verify `components/admin/audit-log-page.tsx`.
  - [ ] SubTask 8.4: Verify `app/admin/page.tsx`.

- [ ] Task 9: Check 7 - WhatsApp and Order Confirmation
  - [ ] SubTask 9.1: Verify `lib/whatsapp.ts`.
  - [ ] SubTask 9.2: Verify `app/payment/callback/page.tsx`.
  - [ ] SubTask 9.3: Verify `app/signup/page.tsx`.

- [ ] Task 10: Phase 3 - Build Verification
  - [ ] SubTask 10.1: Run `npm run build` and fix any errors.
  - [ ] SubTask 10.2: Run final MCP queries.
