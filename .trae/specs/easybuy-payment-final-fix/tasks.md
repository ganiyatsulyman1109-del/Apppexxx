# Tasks

- [ ] Task 1: SQL Schema Fix
  - [ ] SubTask 1.1: Check if `product_id` is nullable in `easybuy_purchases`.
  - [ ] SubTask 1.2: If not nullable, execute `ALTER TABLE easybuy_purchases ALTER COLUMN product_id DROP NOT NULL;`.

- [ ] Task 2: Fix Payment Route POST Handler (Fix 1)
  - [ ] SubTask 2.1: Rewrite `app/api/easybuy/payments/route.ts` POST handler.
    - [ ] Move `lastPurchaseId` declaration inside loop / initialize undefined.
    - [ ] Fix admin `processed_by` logic (null if not staff).
    - [ ] Fix purchase creation fallback (allow null `product_id`).
    - [ ] Add error handling and detailed logging.

- [ ] Task 3: Remaining Balance Updates (Fix 2)
  - [ ] SubTask 3.1: Update `components/easybuy/customer-detail-view.tsx`.
    - [ ] Ensure `handlePaymentRecorded` calls `loadCustomerData()`.
    - [ ] Verify realtime subscriptions for customers, purchases, and payments.
  - [ ] SubTask 3.2: Rewrite `app/api/easybuy/customers/[id]/route.ts` to use `Promise.all`.

- [ ] Task 4: Realtime Metrics Updates (Fix 3)
  - [ ] SubTask 4.1: Update `components/easybuy/easybuy-dashboard.tsx` to subscribe to both tables.
  - [ ] SubTask 4.2: Update `components/easybuy/debt-overview.tsx` to subscribe to both tables.
  - [ ] SubTask 4.3: Update `components/easybuy/reports.tsx` to subscribe to both tables.

- [ ] Task 5: POS Stats Updates (Fix 4)
  - [ ] SubTask 5.1: Update `components/pos/pos-dashboard.tsx` to subscribe to `easybuy_payments`.
  - [ ] SubTask 5.2: Update `components/pos/today-stats.tsx` label to "EasyBuy Payments Received".

- [ ] Task 6: Customer List Product Name and Price (Fix 5)
  - [ ] SubTask 6.1: Update `components/admin/customers-page.tsx` item rendering logic.
  - [ ] SubTask 6.2: Update `app/api/admin/customers/route.ts` to select `items`.

- [ ] Task 7: POS Load Speed (Fix 6)
  - [ ] SubTask 7.1: Update `app/pos/page.tsx` to add `authChecking` state and spinner.

- [ ] Task 8: Verification and Build
  - [ ] SubTask 8.1: Run final SQL verification queries.
  - [ ] SubTask 8.2: Run `pnpm build` and ensure zero errors.
