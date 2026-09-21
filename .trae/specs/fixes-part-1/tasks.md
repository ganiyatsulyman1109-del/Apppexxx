# Tasks

- [ ] Step 0: Create Audit Table & Lib
    - [ ] Run SQL to create `audit_logs` table and indexes via MCP
    - [ ] Create `lib/audit.ts` with `logAudit` function

- [ ] Fix 1: EasyBuy Payment from Admin Fails
    - [ ] Update `components/easybuy/record-payment-modal.tsx`: Remove `getStaffSession`, use `/api/auth/me` to get `processedBy`
    - [ ] Update `app/api/easybuy/payments/route.ts`: Relax validation, fix `resolveStaffUuid`, fix `balance_after`, add `logAudit`

- [ ] Fix 2: Purchase and Payment History
    - [ ] Update `app/api/easybuy/customers/[id]/route.ts`: Use `Promise.all` for parallel queries
    - [ ] Update `components/easybuy/purchase-history-tab.tsx`: Fix columns and formatting
    - [ ] Update `components/easybuy/payment-history-tab.tsx`: Fix columns and formatting
    - [ ] Update `components/easybuy/customer-detail-view.tsx`: Add realtime subscriptions

- [ ] Fix 3: Investor Payment Button & Logic
    - [ ] Update `components/admin/investors-page.tsx`: Add Pay button, fix mapping (Earned/Paid/Owed)
    - [ ] Create/Update `components/admin/record-investor-payment-modal.tsx`: Implement modal with validation
    - [ ] Create/Update `app/api/investors/[id]/payments/route.ts`: Implement POST handler with balance updates and audit
    - [ ] Update `app/api/investors/route.ts` (GET): Implement return accumulation logic

- [ ] Verification
    - [ ] Run `pnpm build` and fix all TypeScript errors
    - [ ] Run MCP verification queries
    - [ ] Grep checks for `getStaffSession` and `processed_by: 'admin'`
