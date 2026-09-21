# Tasks

- [x] Task 1: Fix Product Name Missing from Orders Items JSONB
  - [x] SubTask 1.1: Update `lib/order-utils.ts` to include `name` and `product_name` in the items array.
  - [x] SubTask 1.2: Update `app/api/payments/verify/route.ts` to fetch metadata and enrich `existingOrder` items with product names from the `products` table if they are missing.

- [x] Task 2 & 3: Fix Customer Name and Phone from Checkout
  - [x] SubTask 2.1: Update `app/checkout/page.tsx` Paystack initialization metadata to include `customer_name`, `customer_email`, and `customer_phone`.
  - [x] SubTask 2.2: Update `app/api/payments/verify/route.ts` to prioritize `metadata.customer_name` and use `metadata.customer_phone` when upserting the customer.

- [x] Task 4: Fix WhatsApp Exact Format
  - [x] SubTask 4.1: Rewrite `lib/whatsapp.ts` to accept `customerEmail` and use the exact required message format.
  - [x] SubTask 4.2: Update `components/ecommerce/payment-callback-content.tsx` to pass `customerEmail` and correctly formatted `productNames` to `generateWhatsAppLink`.

- [x] Task 5: Fix EasyBuy Customer Profile Crash
  - [x] SubTask 5.1: Remove `useRouter` from `components/easybuy/customer-detail-view.tsx` and replace `handleNewCreditSale` logic with `window.location.href`.
  - [x] SubTask 5.2: Add null safety to all `new Date()` calls in `convertToEasyBuyCustomer`, `loadCustomerData`, and other mapping functions.
  - [x] SubTask 5.3: Add optional chaining to all `customer` property accesses in the render block and add a fallback loading state.

- [x] Task 6: Fix Admin Settings Page 404
  - [x] SubTask 6.1: Ensure `components/admin/settings-page.tsx` exists and has the correct basic structure.
  - [x] SubTask 6.2: Ensure `app/admin/settings/page.tsx` redirects or renders the settings page properly, and the sidebar/tabs work.

- [x] Task 7: Fix Investor Payment Method
  - [x] SubTask 7.1: Update `components/admin/record-investor-payment-modal.tsx` to only include "Bank Transfer" and "Cash" options in the SelectContent.

- [x] Task 8: Verification
  - [x] SubTask 8.1: Run grep commands to verify `customer_name` in checkout, `customerEmail` in whatsapp.ts, absence of `cheque` in modal, and absence of `useRouter` in customer detail view.
  - [x] SubTask 8.2: Run `pnpm build` to ensure zero TypeScript errors.
