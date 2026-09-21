# Checklist

- [x] Fix 1: `payment_status` is removed from all `easybuy_purchases` queries.
- [x] Fix 1: EasyBuy purchase creation correctly updates `easybuy_customers` debt and total purchases.
- [x] Fix 2: EasyBuy customer lists display `full_name` primarily and format currency correctly.
- [x] Fix 3: Debt Overview and Reports use live data from `easybuy_customers` and `easybuy_purchases`.
- [x] Fix 4: Order Detail View (Eye Icon) opens a modal with complete order information.
- [x] Fix 5: Investor returns accumulate daily and payments can be recorded via modal.
- [x] Fix 6: Notifications can be marked as read individually or all at once.
- [x] Fix 7: "New Credit Sale" button works correctly (navigates or opens modal).
- [x] Fix 7: "Edit Customer" button works and updates customer details.
- [x] Fix 8: API routes use `Promise.all` for parallel queries.
- [x] Fix 9: Stock is deducted after every successful transaction.
- [x] Fix 9: Dashboard metrics update via realtime subscription.
- [x] Verification: `pnpm build` passes with zero errors.
- [x] Verification: MCP queries confirm data integrity.
