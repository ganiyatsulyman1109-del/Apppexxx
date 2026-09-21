# Tasks

- [ ] Task 1: Fix EasyBuy Purchase Creation Logic
  - [ ] Search and remove `payment_status` from all `easybuy_purchases` queries.
  - [ ] Update `components/easybuy/credit-sale-flow.tsx` and relevant API routes to use correct columns for `easybuy_purchases` insert.
  - [ ] Implement `easybuy_customers` debt update logic after purchase creation.

- [ ] Task 2: Fix EasyBuy Customer List Display
  - [ ] Update `components/easybuy/customer-list.tsx` to show `full_name` primarily and format currency.
  - [ ] Update `components/easybuy/easybuy-dashboard.tsx` and other lists.
  - [ ] Verify `app/api/easybuy/customers/route.ts` returns all required fields.

- [ ] Task 3: Fix Debt Overview and Reports
  - [ ] Update `app/api/easybuy/debt-overview/route.ts` to use live data.
  - [ ] Update `components/easybuy/debt-overview.tsx` for currency formatting and credentials.
  - [ ] Update `app/api/easybuy/reports/route.ts` for correct calculations.
  - [ ] Update `components/easybuy/reports.tsx` for currency formatting and credentials.

- [ ] Task 4: Fix Order Detail View
  - [ ] Update `components/admin/orders-page.tsx` to implement/fix the eye icon modal with full order details.

- [ ] Task 5: Fix Investor Management
  - [ ] Implement daily return accumulation logic in investor API.
  - [ ] Create `app/api/investors/[id]/payments/route.ts` for recording payments.
  - [ ] Update `components/admin/investors-page.tsx` to include "Record Payment" button and modal.

- [ ] Task 6: Fix Notifications
  - [ ] Add `PATCH` handler to `app/api/notifications/route.ts`.
  - [ ] Update `components/admin/admin-header.tsx` to handle "mark as read".

- [ ] Task 7: Fix EasyBuy Customer Detail Buttons
  - [ ] Update `components/easybuy/customer-detail-view.tsx` for "New Credit Sale" and "Edit Customer" actions.
  - [ ] Implement `PATCH` endpoint in `app/api/easybuy/customers/[id]/route.ts`.

- [ ] Task 8: Optimize Performance
  - [ ] Refactor `app/api/analytics/dashboard/route.ts` to use `Promise.all`.
  - [ ] Refactor `app/api/easybuy/customers/[id]/route.ts` to use `Promise.all`.
  - [ ] Refactor `app/api/pos/daily-stats/route.ts` to use `Promise.all`.
  - [ ] Refactor `app/api/investors/route.ts` to use `Promise.all`.
  - [ ] Add skeleton loaders where missing.

- [ ] Task 9: System-Wide Accuracy & Verification
  - [ ] Ensure stock deduction logic is present in `app/api/orders/route.ts`.
  - [ ] Run `pnpm build` and fix all TypeScript errors.
  - [ ] Run verification MCP queries.
