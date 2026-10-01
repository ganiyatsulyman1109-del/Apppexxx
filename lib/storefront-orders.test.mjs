import test from "node:test"
import assert from "node:assert/strict"
import { createStorefrontOrder, parseStorefrontOrderInput, StorefrontOrderError } from "./storefront-orders.ts"

const validPayload = {
  businessSlug: "sample-store",
  customerName: "A Customer",
  customerPhone: "08000000000",
  customerEmail: "buyer@example.com",
  deliveryType: "delivery",
  deliveryAddress: "1 Main Street",
  deliveryCity: "Lagos",
  total: 1,
  items: [{ id: "123e4567-e89b-42d3-a456-426614174000", name: "Client supplied", price: 1, quantity: 2 }],
}

test("storefront order input ignores client prices and totals", () => {
  const input = parseStorefrontOrderInput(validPayload)
  assert.deepEqual(input.items, [{ id: validPayload.items[0].id, quantity: 2 }])
  assert.equal("total" in input, false)
  assert.equal("price" in input.items[0], false)
})

test("storefront order input rejects missing delivery details and invalid quantities", () => {
  assert.throws(
    () => parseStorefrontOrderInput({ ...validPayload, deliveryAddress: "" }),
    (error) => error instanceof StorefrontOrderError && error.status === 400
  )
  assert.throws(
    () => parseStorefrontOrderInput({ ...validPayload, items: [{ id: validPayload.items[0].id, quantity: 0 }] }),
    (error) => error instanceof StorefrontOrderError
  )
})

test("atomic order RPC receives only validated item IDs and quantities", async () => {
  let call
  const supabase = {
    rpc: async (...args) => {
      call = args
      return { data: { id: "order-id", order_number: "ORD-123" }, error: null }
    },
  }
  const input = parseStorefrontOrderInput(validPayload)
  const order = await createStorefrontOrder(supabase, "business-id", input, "bank_transfer")
  assert.equal(order.id, "order-id")
  assert.equal(call[0], "create_storefront_order")
  assert.deepEqual(call[1].p_items, [{ id: validPayload.items[0].id, quantity: 2 }])
  assert.equal(call[1].p_business_id, "business-id")
  assert.equal(call[1].p_payment_method, "bank_transfer")
})
