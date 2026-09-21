# JOEBEK Fixes Batch 7 Spec

## Why
Address critical client-side crashes in the EasyBuy customer profile, fix missing product names in admin views for older orders, handle missing customer phone numbers, and correct navigation issues where the admin profile button logs out instead of opening settings.

## What Changes
- **EasyBuy Customer Profile**:
  - Remove all `useRouter` imports and usages.
  - Safely wrap all `Date` parsing.
  - Consolidate loading logic inside a single `try/catch` wrapper in `loadCustomerData`.
  - Add robust fallbacks (`?.` and `||`) to mapping functions.
- **Admin Customers API**:
  - Enrich old order items lacking `name` or `product_name` by querying the `products` table.
- **Customer Phone Missing**:
  - Update `app/api/admin/customers/route.ts` and `components/admin/customers-page.tsx` to handle missing phone numbers gracefully (e.g., fallback to "No phone").
- **Admin Profile Button**:
  - Update `admin-header.tsx` to use `router.push('/admin?tab=settings')` instead of an `<a>` tag that triggers a full page reload and potential logout.

## Impact
- Affected specs: Customer Profile UI, Admin Customers list, Admin Navigation.
- Affected code: `components/easybuy/customer-detail-view.tsx`, `app/api/admin/customers/route.ts`, `components/admin/customers-page.tsx`, `components/admin/admin-header.tsx`.

## MODIFIED Requirements
### Requirement: Customer Profile Robustness
The customer profile view SHALL handle incomplete data safely without causing client-side crashes, using native browser navigation for links instead of Next.js router where context is missing.

### Requirement: Admin Customers View
The admin customers view SHALL correctly display product names for all orders (even legacy ones) by enriching missing item data from the products table, and gracefully display "No phone" for missing phone numbers.

### Requirement: Admin Header Navigation
The Admin Header's "My Profile" button SHALL navigate seamlessly to the settings tab without causing a full application reload or unintended logout.
