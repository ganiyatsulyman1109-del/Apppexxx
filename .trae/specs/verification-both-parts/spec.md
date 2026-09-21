# System Verification Spec (Part 1 & 2)

## Why
To ensure the stability, security, and correctness of the recent fixes applied to the JOEBEK system, specifically focusing on audit logging, role-based access control, payment processing, and investor management.

## What Changes
- This is a verification and fix pass. No new features are planned unless verification fails.
- Any code found violating the "Zero tolerance" rules (e.g., forbidden imports, hardcoded admin strings) will be fixed immediately.

## Impact
- **Security**: Ensures strict adherence to `requireAdminAuth` and `requireStaffOrAdminAuth`.
- **Data Integrity**: Verifies audit logs are being generated and payments are correctly calculated.
- **User Experience**: Confirms UI components for payments, history, and admin management work as expected.

## Verification Requirements

### Phase 1: MCP Data Validation
- Verify `audit_logs` table existence and schema.
- Check row counts for key tables (`audit_logs`, `easybuy_payments`, `investor_payments`).
- Verify data integrity for `investors` and `easybuy_customers`.

### Phase 2: Code Static Analysis
- **Forbidden Patterns**:
  - `getStaffSession` in `components/` (must be empty).
  - `processed_by: 'admin'` (must be empty).
  - `requireAuth` in `app/api/` (must be empty).
  - `payment_status` in `easybuy_purchases` inserts (must be empty).
  - `getStaffSession` in `app/api/` (must be empty).

### Phase 3: Functional Verification (Checks 1-7)
1.  **Audit System**: `lib/audit.ts` exists and works; table exists.
2.  **EasyBuy Payment**: `RecordPaymentModal` uses correct auth; API validates correctly; Audit logged.
3.  **Purchase History**: Parallel queries in API; correct UI rendering for history tabs; Realtime updates.
4.  **Investor Payment**: Admin UI has payment button; Modal works; API enforces auth and balance checks; Audit logged.
5.  **Order Management**: `requireAdminAuth` on DELETE/PATCH; Stock restoration on delete; Audit logged.
6.  **Audit Log Page**: Route exists; Sidebar updated; Page renders logs correctly.
7.  **WhatsApp & Confirmation**: `lib/whatsapp.ts` exists; Callback page has WhatsApp button; Signup pre-fills read-only email.

### Phase 4: Build Verification
- `npm run build` must pass with zero errors.
