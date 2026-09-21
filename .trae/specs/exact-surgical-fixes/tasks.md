# Tasks

- [x] Task 1: Fix POS Registration Blank Page
    - [x] Remove `getStaffSession` and `storageService` from `register-customer-modal.tsx`
    - [x] Update `RegisterCustomerModal` props to accept `staffId`
    - [x] Rewrite `handleSubmit` to use props and remove photo upload
    - [x] Update `easybuy-dashboard.tsx` to pass `staffId` to modal

- [x] Task 2: Fix Notification Click 404
    - [x] Update `admin-header.tsx` to map `/admin/path` to `/admin?tab=path`
    - [x] Update `app/admin/page.tsx` to handle `tab` query param
    - [x] Update `lib/notifications.ts` to use correct URL format
    - [x] Run SQL migration to fix existing notification URLs via MCP

- [x] Task 3: Fix EasyBuy List Data Display
    - [x] Export `convertToEasyBuyCustomer` from `customer-list.tsx`
    - [x] Update `easybuy-dashboard.tsx` to import and use conversion function
    - [x] Add realtime subscription to `easybuy-dashboard.tsx`
    - [x] Verify/Update `admin/easybuy-page.tsx` with similar mapping

- [x] Task 4: Implement Investor Payment Flow
    - [x] Create `components/admin/record-investor-payment-modal.tsx`
    - [x] Update `components/admin/investors-page.tsx` to add Payment button and modal usage
    - [x] Update `components/admin/investors-page.tsx` data mapping
    - [x] Create `app/api/investors/[id]/payments/route.ts`

- [x] Task 5: Final Verification & Build
    - [x] Run `pnpm build` and fix all TypeScript errors
    - [x] Verify all fixes with MCP queries as requested
