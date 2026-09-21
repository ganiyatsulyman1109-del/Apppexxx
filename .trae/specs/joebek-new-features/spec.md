# Apex — NEW FEATURES PROMPT Spec

## Why
To improve user experience and administrative capabilities, new features are required: enhanced post-payment signup flow, WhatsApp integration, better financial tracking for investors, comprehensive customer management for admins, and clearer navigation options after order confirmation.

## What Changes

### FEATURE 1 — SIGNUP FORM PRE-FILLED AFTER PAYMENT
- **Change**: Pass customer details (name, email, phone, order number) as query parameters to the signup page from the payment callback.
- **Change**: Signup page pre-fills fields from query parameters.
- **Change**: Email field becomes read-only if pre-filled.
- **Change**: Redirect to account page with success message after signup.

### FEATURE 2 — WHATSAPP PREFILLED MESSAGE ACCURATE
- **Change**: Create `lib/whatsapp.ts` to generate formatted WhatsApp links.
- **Change**: Add "Chat with Us on WhatsApp" button to `payment-callback-content.tsx` using the new helper.
- **Change**: Message includes customer name, product names, total amount, and order ID.

### FEATURE 3 — INVESTOR REVENUE TRACKING
- **Change**: Update `components/admin/dashboard-home.tsx` to display investor financial obligations separately.
- **Change**: Calculate Net Revenue as Total Revenue minus Investor Obligations.
- **Change**: Fetch investor totals from `investors` table.

### FEATURE 4 — ECOMMERCE CUSTOMER LIST FOR COMPANY
- **Change**: Create `app/api/admin/customers/route.ts` to fetch all customers with their order history.
- **Change**: Update `components/admin/admin-sidebar.tsx` to include "Customers" link.
- **Change**: Create `components/admin/customers-page.tsx` to display customer table with search and view orders functionality.
- **Change**: Update `app/admin/page.tsx` to render the new Customers page.

### FEATURE 5 — LOGIN BUTTON ON ORDER CONFIRMATION
- **Change**: Update `components/ecommerce/payment-callback-content.tsx` to show login/signup options if user is not authenticated.
- **Change**: Add check for existing session.
- **Change**: Add buttons for "Create Account to Track Order" (pre-filled) and "Sign In".

## Impact
- **Customers**: Smoother transition from guest checkout to account creation; easy support contact via WhatsApp.
- **Admins**: Better visibility into customer base and true financial standing (net revenue).
- **Investors**: Clearer separation of company revenue vs. investor obligations.
