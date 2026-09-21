# Root Cause Fixes Spec

## Why
There are several remaining bugs and crashes that need to be addressed at the root cause level, including missing product names in orders, incorrect customer names from checkout, missing phone numbers, WhatsApp link formatting, EasyBuy customer profile crashes, Admin settings page 404, and investor payment method options.

## What Changes
- **Order Items JSONB**: Update `createOrderTransaction` to save `name` and `product_name`. Update `verify` route to enrich existing items with product names from the `products` table if missing.
- **Checkout Metadata**: Include `customer_name`, `customer_email`, and `customer_phone` in the Paystack initialization metadata in `app/checkout/page.tsx`.
- **Verify Route Logic**: Prioritize `metadata.customer_name` over the Paystack customer object. Use `metadata.customer_phone` when upserting the customer.
- **WhatsApp Link Format**: Rewrite `generateWhatsAppLink` in `lib/whatsapp.ts` to explicitly use the format with the `customerEmail` parameter. Update `payment-callback-content.tsx` to call it correctly.
- **EasyBuy Customer Profile**: Remove `useRouter` from `components/easybuy/customer-detail-view.tsx`, wrap all `Date` constructors with null checks, and add optional chaining to customer property accesses.
- **Admin Settings Page**: Ensure `components/admin/settings-page.tsx` exists and is integrated properly into `app/admin/page.tsx` and the sidebar. Add `app/admin/settings/page.tsx` if needed for separate routing.
- **Investor Payment Method**: Restrict options in `components/admin/record-investor-payment-modal.tsx` to "Bank Transfer" and "Cash" only.

## Impact
- Affected specs: Checkout flow, Payment Verification, EasyBuy Customer Profile, Admin Settings, Investor Payments.
- Affected code: `lib/order-utils.ts`, `app/api/payments/verify/route.ts`, `app/checkout/page.tsx`, `lib/whatsapp.ts`, `components/ecommerce/payment-callback-content.tsx`, `components/easybuy/customer-detail-view.tsx`, `app/admin/page.tsx`, `components/admin/settings-page.tsx`, `components/admin/record-investor-payment-modal.tsx`.

## MODIFIED Requirements
### Requirement: Product Name in Orders
The system SHALL save product names in the `items` JSONB array for orders. If an existing order lacks names, the verify route SHALL enrich the items by querying the `products` table.

### Requirement: Checkout Metadata
The checkout process SHALL send the customer's full name, email, and phone number in the Paystack initialization metadata.

### Requirement: Customer Profile Stability
The EasyBuy customer profile SHALL NOT crash due to missing properties or undefined dates, and SHALL NOT use `useRouter` inappropriately.

### Requirement: WhatsApp Link Format
The WhatsApp link generation SHALL include the customer's email if provided, matching a specific text format.

### Requirement: Admin Settings
The Admin Settings page SHALL exist and be accessible without returning a 404 error.

### Requirement: Investor Payments
Investor payment recording SHALL ONLY allow "Bank Transfer" and "Cash" methods.
