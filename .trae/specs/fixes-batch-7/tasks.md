# Tasks

- [x] Task 1: Fix EasyBuy Customer Profile Client Crash
  - [x] SubTask 1.1: Remove `useRouter` import and references from `components/easybuy/customer-detail-view.tsx`.
  - [x] SubTask 1.2: Add a try/catch wrapper around the entire `loadCustomerData` function.
  - [x] SubTask 1.3: Update `convertToEasyBuyCustomer`, `purchasesList` mapping, and `paymentsList` mapping to use strict null checks and default values for dates and objects.

- [x] Task 2: Fix Product Name in View Orders (Admin Customers)
  - [x] SubTask 2.1: Update `app/api/admin/customers/route.ts` to identify orders lacking item names.
  - [x] SubTask 2.2: Query the `products` table for missing names and enrich the returned payload.

- [x] Task 3: Fix Customer Phone Missing
  - [x] SubTask 3.1: Update `components/admin/customers-page.tsx` to safely display `{customer.phone || 'No phone'}`.

- [x] Task 4: Fix Admin Profile Button Logs Out
  - [x] SubTask 4.1: Update `components/admin/admin-header.tsx` to use `router.push('/admin?tab=settings')` instead of `href="/admin/settings"`.

- [x] Task 5: Verification
  - [x] SubTask 5.1: Run grep commands to verify removal of `useRouter` from customer view.
  - [x] SubTask 5.2: Run grep commands to verify `router.push` in admin header.
  - [x] SubTask 5.3: Run grep commands to verify enrichment logic (`productNameMap`) in admin customers API.
  - [x] SubTask 5.4: Run `pnpm build` and ensure zero TypeScript errors.