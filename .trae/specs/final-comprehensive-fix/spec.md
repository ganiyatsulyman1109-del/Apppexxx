# Final Comprehensive Fix Spec

## Why
To resolve critical issues causing purchase failures, incorrect data display, missing functionality (investor payments, notifications), and performance bottlenecks. The system needs to be robust, accurate, and performant for production use.

## What Changes

### Fix 1: EasyBuy Purchase Creation Fails
- **BREAKING**: Remove `payment_status` column reference from all `easybuy_purchases` queries. It does not exist.
- Update `easybuy_purchases` insert logic to use only valid columns: `easybuy_customer_id`, `order_id`, `product_id`, `quantity`, `unit_price`, `total_amount`, `down_payment`, `remaining_balance`, `payment_plan_months`, `monthly_payment`, `status`, `purchase_date`, `expected_completion_date`.
- Ensure `easybuy_customers` debt and total purchases are updated transactionally after purchase creation.

### Fix 2: EasyBuy List Shows Phone Not Name
- Update all EasyBuy customer lists to display `full_name` as primary text.
- Move `phone` to secondary text.
- Format all currency values using `toLocaleString('en-NG')`.
- Ensure API returns all necessary fields (`credit_limit`, `current_debt`, `total_purchases`, `total_payments`, `status`, `last_payment`).

### Fix 3: Debt Overview and Reports Accurate
- Update `app/api/easybuy/debt-overview/route.ts` to query live data from `easybuy_customers` and `easybuy_purchases`.
- Update `app/api/easybuy/reports/route.ts` to calculate totals from live customer data.
- Fix UI components to display formatted currency and correct stats.

### Fix 4: Order Detail View (Eye Icon)
- Implement/Fix the order detail modal in `components/admin/orders-page.tsx`.
- Ensure it displays: order number, source, status, payment status, total amount, items list, customer info, date.

### Fix 5: Investor Management
- **New Feature**: Implement daily return accumulation logic in `app/api/investors/[id]/route.ts` (or relevant fetch handler).
- **New Feature**: Add "Record Payment" functionality for investors.
    - Create `app/api/investors/[id]/payments/route.ts`.
    - Update `investors` table (`total_returns_paid`, `current_balance`, `last_payment_date`, `next_payment_date`).
    - Insert into `investor_payments`.

### Fix 6: Notifications Mark as Read
- Implement `PATCH` handler in `app/api/notifications/route.ts` to mark single or all notifications as read.
- Update `components/admin/admin-header.tsx` to use this API and update UI state.

### Fix 7: EasyBuy Customer Detail Buttons
- Fix "New Credit Sale" button to navigate correctly or open modal.
- Implement "Edit Customer" modal and `PATCH` endpoint for updating customer details.

### Fix 8: Performance: All Pages Instant
- Refactor API routes to use `Promise.all` for parallel queries instead of sequential `await`.
- Add skeleton loaders to pages with data fetching.

### Fix 9: System-Wide Accuracy
- Remove `payment_status` from all `easybuy_purchases` queries.
- Ensure stock is deducted after every successful transaction.
- Ensure notifications are created.
- Ensure dashboard metrics update via realtime subscription.

## Impact
- **Affected Specs**: EasyBuy, Investors, Orders, Notifications, Admin Dashboard.
- **Affected Code**: API routes (`/api/easybuy/*`, `/api/investors/*`, `/api/orders/*`, `/api/notifications/*`), Components (`pos`, `admin`, `easybuy`).
