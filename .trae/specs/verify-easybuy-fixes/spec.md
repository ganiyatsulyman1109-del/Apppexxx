# Verify EasyBuy Payment Fixes Spec

## Why
We need to rigorously verify that the recent fixes for EasyBuy payments, POS, and Admin features are correctly implemented and that the system is stable. This involves database schema checks, code pattern verification (grep), specific logic checks, and a full build.

## What Changes
- This is a verification and fix pass. No new features are planned unless a check fails.
- Key areas to verify:
  - Database: `easybuy_purchases.product_id` nullable status.
  - API: `app/api/easybuy/payments/route.ts` safety and logic.
  - UI: Realtime updates in Customer Detail, Dashboard, Debt Overview, Reports, POS.
  - UI: Correct data display in Admin Customer List and POS stats.
  - Performance: POS load speed.

## Impact
- **Affected Specs**: EasyBuy, POS, Admin.
- **Affected Code**: 
  - `app/api/easybuy/payments/route.ts`
  - `components/easybuy/customer-detail-view.tsx`
  - `app/api/easybuy/customers/[id]/route.ts`
  - `components/easybuy/easybuy-dashboard.tsx`
  - `components/easybuy/debt-overview.tsx`
  - `components/easybuy/reports.tsx`
  - `components/pos/pos-dashboard.tsx`
  - `components/pos/today-stats.tsx`
  - `components/admin/customers-page.tsx`
  - `app/api/admin/customers/route.ts`
  - `app/pos/page.tsx`

## Verification Requirements (from User Prompt)

### Phase 1: MCP Checks
- `product_id` in `easybuy_purchases` MUST be nullable.
- `payment_method` constraint MUST include `pos_terminal` and `bank_transfer`.
- Data verification for `easybuy_payments`, `easybuy_customers`, `easybuy_purchases`.

### Phase 2: Grep Checks
- `pendingPurchases[0].id` access MUST be safe (checked).
- No zero-UUIDs (`00000000...`).
- Admin `processed_by` MUST NOT fallback to staff email lookup.
- `balanceAfter` MUST be mapped correctly.
- Realtime subscriptions MUST exist in dashboards.

### Check 1: Payment Route Safe
- `lastPurchaseId` safely initialized.
- Guard against undefined `lastPurchaseId`.
- Admin `processed_by` is null.
- `product_id` fallback is null.
- Logging exists.
- Check `easybuy_purchase_id` nullability if `lastPurchaseId` can be null.

### Check 2: Remaining Balance Updates
- `handlePaymentRecorded` calls `loadCustomerData`.
- 3 realtime subscriptions in `customer-detail-view.tsx`.
- API uses `Promise.all` and returns correct data.

### Check 3: Customer List Realtime
- `easybuy-dashboard.tsx`, `debt-overview.tsx`, `reports.tsx` subscribe to BOTH `easybuy_customers` and `easybuy_payments`.

### Check 4: POS Stats Correct
- `paidSales` filtering logic.
- `easyBuyCredit` fetching and label ("EasyBuy Payments Received").
- Realtime subscription on `easybuy_payments`.

### Check 5: Customer List Product Name & Price
- Item rendering logic (parsing, naming, pricing, unicode multiplication).
- API selects `items`.

### Check 6: POS Loads Fast
- `authChecking` state with spinner.

### Phase 3: Build
- `pnpm build` with zero errors.
