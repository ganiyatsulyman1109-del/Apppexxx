# Tasks

- [ ] Task 1: Implement Signup Form Pre-fill
  - [ ] Read `components/ecommerce/payment-callback-content.tsx`.
  - [ ] Update "Create Account" button logic to pass query params (email, name, phone, order).
  - [ ] Read `app/signup/page.tsx`.
  - [ ] Update signup form to read params, pre-fill state, and make email read-only if present.
  - [ ] Ensure redirect to `/account?registered=true` after success.

- [ ] Task 2: Implement WhatsApp Integration
  - [ ] Create `lib/whatsapp.ts` with `generateWhatsAppLink` function.
  - [ ] Read `components/ecommerce/payment-callback-content.tsx`.
  - [ ] Add WhatsApp button with generated link using actual order data.
  - [ ] Ensure `NEXT_PUBLIC_WHATSAPP_NUMBER` is set in `.env.local` if missing.

- [ ] Task 3: Implement Investor Revenue Tracking
  - [ ] Read `components/admin/dashboard-home.tsx`.
  - [ ] Add logic to fetch investor totals (`current_balance`, `total_returns_paid`) from `investors` table.
  - [ ] Add summary cards for Total Revenue, Investor Obligations, and Net Revenue.

- [ ] Task 4: Implement Ecommerce Customer List
  - [ ] Create `app/api/admin/customers/route.ts` to fetch customers with orders.
  - [ ] Read `components/admin/admin-sidebar.tsx`.
  - [ ] Add "Customers" navigation item.
  - [ ] Create `components/admin/customers-page.tsx` with table, search, and details view.
  - [ ] Read `app/admin/page.tsx`.
  - [ ] Add rendering logic for 'customers' view.

- [ ] Task 5: Implement Login Button on Order Confirmation
  - [ ] Read `components/ecommerce/payment-callback-content.tsx`.
  - [ ] Add session check using `createBrowserClient`.
  - [ ] Render Login and Signup buttons if user is not logged in.

- [ ] Task 6: Verification & Build
  - [ ] Run `pnpm build` and fix any type errors.
  - [ ] Verify environment variables.
  - [ ] Verify SQL queries via MCP.
