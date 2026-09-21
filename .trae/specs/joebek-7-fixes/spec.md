# JOEBEK — FIXES PROMPT Spec

## Why
Multiple critical issues have been identified in the current codebase affecting staff authentication, investor creation, customer login/orders, easybuy payments, and analytics. These need to be fixed to ensure system stability and correctness.

## What Changes

### FIX 1 — STAFF ID FORMAT
- **Change**: Staff ID format must be `STAFF001` (3 digits) instead of `STAFF0001` (4 digits).
- **Migration**: Update existing staff IDs in the database to match the new format.

### FIX 2 — STAFF PIN LOGIN
- **Change**: Staff login must use `bcrypt.compare` for PIN verification.
- **Change**: Staff PIN updates must hash the PIN before saving to the database.
- **Change**: Staff lookup should be case-insensitive if exact match fails.

### FIX 3 — INVESTOR PASSWORD UNIFIED
- **Change**: Remove server-side password generation for investors.
- **Change**: Use the password provided by the frontend (which is generated/set there) for creating the auth user.
- **Change**: Ensure the returned `tempPassword` matches the one sent from frontend.
- **Change**: Ensure password updates during investor editing also update the auth user.

### FIX 4 — CUSTOMER LOGIN FAILS AFTER SIGNUP
- **Change**: Login API route should set session cookies on the response object so the browser persists the session.
- **Change**: Alternatively (and preferred), update the login page to use the Supabase browser client for direct authentication, bypassing the API route for the initial sign-in to ensure proper session handling.

### FIX 5 — CUSTOMER ORDERS NOT SHOWING AFTER SIGNUP
- **Change**: Fix order fetching logic to resolve `customer_id` from the `customers` table using the `user_id` (auth ID), rather than assuming `customer_id` equals `user_id`.
- **Change**: When a user registers, if they were previously a guest (customer record exists without `user_id`), ensure existing orders linked to that customer record remain accessible.

### FIX 6 — EASYBUY PAYMENT FROM ADMIN FAILS
- **Change**: Remove `getStaffSession` call in `record-payment-modal.tsx` as it fails in admin context.
- **Change**: Resolve `processed_by` ID by fetching current user/staff ID via API or context.
- **Change**: Update `resolveStaffUuid` in the API to accept valid UUIDs directly (for admin users) and not just staff IDs.

### FIX 7 — PENDING ORDERS ACCURATE
- **Change**: Ensure pending orders count query includes ALL orders with `status='pending'`, regardless of source.
- **Change**: Ensure the dashboard subscribes to realtime changes on the `orders` table to update the count immediately.

## Impact
- **Staff**: Login will work reliably; IDs will be consistent.
- **Investors**: Account creation will result in working credentials.
- **Customers**: Login will work immediately; past guest orders will be visible after signup.
- **Admin**: EasyBuy payments can be recorded; Dashboard stats will be accurate.
