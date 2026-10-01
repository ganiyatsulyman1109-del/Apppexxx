import assert from "node:assert/strict"
import test from "node:test"
import { parseOrderPage } from "./order-pagination.ts"

test("customer order pagination defaults to the existing response page size", () => {
  assert.deepEqual(parseOrderPage(new URLSearchParams()), { limit: 50, offset: 0 })
})

test("customer order pagination accepts bounded integer values", () => {
  assert.deepEqual(
    parseOrderPage(new URLSearchParams("limit=25&offset=100")),
    { limit: 25, offset: 100 },
  )
})

test("customer order pagination rejects invalid and excessive ranges", () => {
  for (const query of ["limit=0", "limit=101", "limit=5.5", "limit=1e2", "limit=abc", "offset=-1", "offset=1000001"]) {
    assert.equal(parseOrderPage(new URLSearchParams(query)), null, query)
  }
})
