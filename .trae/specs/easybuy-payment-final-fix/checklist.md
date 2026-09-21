# Checklist

- [ ] SQL: `product_id` in `easybuy_purchases` is nullable.
- [ ] API: `app/api/easybuy/payments/route.ts` does NOT crash when `pendingPurchases` is empty.
- [ ] API: `app/api/easybuy/payments/route.ts` does NOT use dummy UUID `00000000...`.
- [ ] API: `app/api/easybuy/payments/route.ts` correctly sets `processed_by` to null for admins.
- [ ] UI: `customer-detail-view.tsx` updates immediately after payment.
- [ ] UI: `customer-detail-view.tsx` has realtime subscriptions for customers, purchases, and payments.
- [ ] API: `app/api/easybuy/customers/[id]/route.ts` uses `Promise.all`.
- [ ] UI: `easybuy-dashboard.tsx` updates in realtime.
- [ ] UI: `debt-overview.tsx` updates in realtime.
- [ ] UI: `reports.tsx` updates in realtime.
- [ ] UI: POS Dashboard updates stats in realtime on payment.
- [ ] UI: POS Today Stats shows "EasyBuy Payments Received".
- [ ] UI: Admin Customer List shows product names and prices correctly.
- [ ] API: `app/api/admin/customers/route.ts` returns `items`.
- [ ] UI: POS page shows spinner while checking auth.
- [ ] Build: `pnpm build` passes with zero errors.
