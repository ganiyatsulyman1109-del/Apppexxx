# Tasks

- [ ] Task 1: Phase 1 - MCP Checks (Database)
  - [ ] SubTask 1.1: Verify `easybuy_purchases.product_id` is nullable. (If NO, stop).
  - [ ] SubTask 1.2: Verify `payment_method` constraint.
  - [ ] SubTask 1.3: Verify data integrity (payments, customers, purchases).

- [ ] Task 2: Phase 2 - Grep Checks (Code Safety)
  - [ ] SubTask 2.1: Verify `pendingPurchases` access safety in payments route.
  - [ ] SubTask 2.2: Verify zero-UUID removal.
  - [ ] SubTask 2.3: Verify admin `processed_by` logic.
  - [ ] SubTask 2.4: Verify `balanceAfter` mapping.
  - [ ] SubTask 2.5: Verify realtime subscriptions in dashboards.

- [ ] Task 3: Check 1 - Payment Route Safety Verification
  - [ ] SubTask 3.1: Read `app/api/easybuy/payments/route.ts` and verify all safety requirements.
  - [ ] SubTask 3.2: Check `easybuy_purchase_id` nullability if needed.

- [ ] Task 4: Check 2 - Remaining Balance Updates Verification
  - [ ] SubTask 4.1: Verify `customer-detail-view.tsx` (logic & subscriptions).
  - [ ] SubTask 4.2: Verify `app/api/easybuy/customers/[id]/route.ts`.

- [ ] Task 5: Check 3 - Customer List Realtime Verification
  - [ ] SubTask 5.1: Verify `easybuy-dashboard.tsx`.
  - [ ] SubTask 5.2: Verify `debt-overview.tsx`.
  - [ ] SubTask 5.3: Verify `reports.tsx`.

- [ ] Task 6: Check 4 - POS Stats Verification
  - [ ] SubTask 6.1: Verify `pos-dashboard.tsx` (filtering & subscription).
  - [ ] SubTask 6.2: Verify `today-stats.tsx` (label).

- [ ] Task 7: Check 5 - Customer List Product Name & Price Verification
  - [ ] SubTask 7.1: Verify `components/admin/customers-page.tsx`.
  - [ ] SubTask 7.2: Verify `app/api/admin/customers/route.ts`.

- [ ] Task 8: Check 6 - POS Load Speed Verification
  - [ ] SubTask 8.1: Verify `app/pos/page.tsx` auth checking state.

- [ ] Task 9: Phase 3 - Build & Final Verification
  - [ ] SubTask 9.1: Run `pnpm build`.
  - [ ] SubTask 9.2: Run final MCP schema checks.
  - [ ] SubTask 9.3: Generate final report.
