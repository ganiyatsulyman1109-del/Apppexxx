# EasyBuy Payment Final Root Cause Fix Spec

## Why
A critical crash in the payment processing logic (`app/api/easybuy/payments/route.ts`) causes 500 errors when `pendingPurchases` is empty, killing payments from both admin and POS. Additionally, `product_id` NOT NULL constraint on `easybuy_purchases` causes FK violations, and admin `processed_by` resolution fails because admins are not in the staff table. Several UI and realtime update issues also need addressing.

## What Changes
- **Database Schema**: Make `product_id` in `easybuy_purchases` nullable.
- **Backend API**:
  - Rewrite `app/api/easybuy/payments/route.ts` POST handler to safely handle empty purchase lists, fix admin `processed_by` logic, and relax `product_id` requirements.
  - Update `app/api/easybuy/customers/[id]/route.ts` to use parallel fetching (`Promise.all`) for better performance.
  - Update `app/api/admin/customers/route.ts` to include `items` in the response.
- **Frontend Components**:
  - `components/easybuy/customer-detail-view.tsx`: Ensure `loadCustomerData` is called before closing modal and verify realtime subscriptions.
  - `components/easybuy/easybuy-dashboard.tsx`, `debt-overview.tsx`, `reports.tsx`: Ensure realtime subscriptions cover both `easybuy_customers` and `easybuy_payments`.
  - `components/pos/pos-dashboard.tsx`, `today-stats.tsx`: Add realtime subscription for payments and update labels.
  - `components/admin/customers-page.tsx`: Fix product name/price display logic.
  - `app/pos/page.tsx`: Add loading state to improve perceived load speed.

## Impact
- **Affected Specs**: EasyBuy, POS, Admin Dashboard.
- **Affected Code**: 
  - `app/api/easybuy/payments/route.ts`
  - `app/api/easybuy/customers/[id]/route.ts`
  - `app/api/admin/customers/route.ts`
  - `components/easybuy/customer-detail-view.tsx`
  - `components/easybuy/easybuy-dashboard.tsx`
  - `components/easybuy/debt-overview.tsx`
  - `components/easybuy/reports.tsx`
  - `components/pos/pos-dashboard.tsx`
  - `components/pos/today-stats.tsx`
  - `components/admin/customers-page.tsx`
  - `app/pos/page.tsx`

## ADDED Requirements
### Requirement: Payment Processing Stability
The system SHALL process payments successfully even if no pending purchases exist (creating a credit balance or applying to customer debt).
The system SHALL NOT crash when accessing `pendingPurchases[0]` if the array is empty.

### Requirement: Admin Payment Processing
The system SHALL allow admins (who are not in the `staff` table) to process payments, setting `processed_by` to NULL.

### Requirement: Realtime Updates
The system SHALL update customer debt, payment history, and dashboard metrics in realtime across all relevant views (Customer Detail, Dashboard, Debt Overview, Reports, POS).

### Requirement: POS Loading State
The POS page SHALL show a loading spinner while checking authentication status to prevent UI flicker or "unauthorized" flashes.

## MODIFIED Requirements
### Requirement: Purchase Creation
The system SHALL create purchase records from orders even if `product_id` is missing (setting it to NULL instead of a dummy UUID).

### Requirement: POS Stats
The POS "Today's Stats" SHALL include "EasyBuy Payments Received" as a distinct metric.
