# JOEBEK Fixes Part 1 Spec

## Why
To resolve critical issues preventing admin from recording EasyBuy payments, ensuring data integrity with audit logs, correcting history views, and enabling investor payment recording with accurate return calculations.

## What Changes

### Step 0: Audit Logging
- **New Table**: `audit_logs` for tracking system actions.
- **New Lib**: `lib/audit.ts` helper function `logAudit`.

### Fix 1: EasyBuy Payment from Admin
- **Component Fix**: `record-payment-modal.tsx` - Remove `getStaffSession` (fails in admin), fetch user/staff ID via `/api/auth/me`.
- **API Fix**: `app/api/easybuy/payments/route.ts` - Relax validation (remove `processed_by` check if handled internally), improve `resolveStaffUuid` to handle UUIDs directly, fix `balance_after` calculation.
- **Impact**: Admin can record payments without 400 errors.

### Fix 2: Purchase and Payment History
- **API Optimization**: `app/api/easybuy/customers/[id]/route.ts` - Use `Promise.all` for parallel queries (customer, purchases, payments).
- **UI Fix**: `purchase-history-tab.tsx` - Show order number, date, amount, balance, status with correct colors/formatting.
- **UI Fix**: `payment-history-tab.tsx` - Show date, amount, method, balance after, processed by.
- **Realtime**: `customer-detail-view.tsx` - Add realtime subscriptions for purchases, payments, and customer updates.

### Fix 3: Investor Payment Button
- **UI Update**: `investors-page.tsx` - Add "Pay Investor" button, fix data mapping (Earned/Paid/Owed), update `RecordInvestorPaymentModal` props.
- **Component**: `record-investor-payment-modal.tsx` - Ensure exists/implemented with amount validation.
- **API**: `app/api/investors/[id]/payments/route.ts` - Implement POST to record payment and update investor balance/dates. Audit log included.
- **API**: `app/api/investors/route.ts` (GET) - Implement on-the-fly calculation of accumulated returns based on days since investment.

## Impact
- **Security**: Audit logs added.
- **Reliability**: Admin payment recording fixed.
- **Performance**: Parallel queries for customer details.
- **Data Accuracy**: Investor returns calculated correctly.
