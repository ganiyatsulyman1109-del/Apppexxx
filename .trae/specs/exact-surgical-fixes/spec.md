# Exact Surgical Fixes Spec

## Why
The current system has critical bugs preventing core functionality:
1.  **POS Registration**: Crushes due to server action usage in client component.
2.  **Notifications**: Links lead to 404 pages because of incorrect URL structure.
3.  **EasyBuy List**: Displays raw data (snake_case) instead of formatted (camelCase), showing phone numbers as names.
4.  **Investor Payments**: Missing UI controls and backend logic for recording payments.

## What Changes

### Fix 1: POS Registration Blank Page
- **Modify** `components/easybuy/register-customer-modal.tsx`:
    - Remove `getStaffSession` (server action) and `storageService`.
    - Accept `staffId` as a prop.
    - Update `handleSubmit` to use `staffId` prop and remove photo upload logic.
- **Modify** `components/easybuy/easybuy-dashboard.tsx`:
    - Pass `staffId` to `RegisterCustomerModal`.

### Fix 2: Notification Click Goes to 404
- **Modify** `components/admin/admin-header.tsx`:
    - Use `useRouter` for navigation.
    - Map legacy paths (`/admin/orders`) to query params (`/admin?tab=orders`).
- **Modify** `app/admin/page.tsx`:
    - Read `tab` query param to set active tab on load.
- **Modify** `lib/notifications.ts`:
    - Update hardcoded notification URLs to use query params.
- **Database**:
    - Run SQL updates to fix existing notification URLs.

### Fix 3: EasyBuy List Shows Phone, Fields Blank
- **Modify** `components/easybuy/customer-list.tsx`:
    - Export `convertToEasyBuyCustomer` function.
- **Modify** `components/easybuy/easybuy-dashboard.tsx`:
    - Import and use `convertToEasyBuyCustomer` to map API response.
    - Add realtime subscription for `easybuy_customers`.
- **Modify** `components/admin/easybuy-page.tsx` (if applicable):
    - Apply similar data mapping.

### Fix 4: Investor Payment Button Missing
- **Modify** `components/admin/investors-page.tsx`:
    - Add "Record Payment" button.
    - Map investor data to camelCase (balance fields).
    - Fix "Total Paid" display column.
    - Use `RecordInvestorPaymentModal`.
- **Create** `components/admin/record-investor-payment-modal.tsx`:
    - Implement modal for recording payments.
- **Create** `app/api/investors/[id]/payments/route.ts`:
    - Implement `POST` handler to record payment and update investor balance.

## Impact
- **POS**: Stable customer registration.
- **Admin**: Working navigation from notifications.
- **EasyBuy**: Correct data display.
- **Investors**: Functional payment recording system.
