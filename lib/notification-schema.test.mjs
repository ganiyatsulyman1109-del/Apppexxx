import test from "node:test"
import assert from "node:assert/strict"
import { presentNotification, toDatabaseNotificationType } from "./notification-schema.ts"

test("notification writer maps application event names to live constraint values", () => {
  assert.equal(toDatabaseNotificationType("low_stock"), "stock")
  assert.equal(toDatabaseNotificationType("new_order"), "order")
  assert.equal(toDatabaseNotificationType("payment"), "payment")
  assert.equal(toDatabaseNotificationType("easybuy"), "info")
  assert.equal(toDatabaseNotificationType("investor"), "info")
  assert.equal(toDatabaseNotificationType("system"), "info")
})

test("notification writer accepts only values allowed by the deployed check", () => {
  for (const type of ["info", "success", "warning", "error", "order", "payment", "stock"]) {
    assert.equal(toDatabaseNotificationType(type), type)
  }
  assert.equal(toDatabaseNotificationType("toString"), null)
  assert.equal(toDatabaseNotificationType("unknown"), null)
})

test("notification response preserves legacy navigation aliases over the live link column", () => {
  assert.deepEqual(presentNotification({
    id: "notification-1",
    type: "stock",
    link: "/admin?tab=inventory",
  }), {
    id: "notification-1",
    type: "stock",
    link: "/admin?tab=inventory",
    action_url: "/admin?tab=inventory",
    action_text: null,
    expires_at: null,
    category: "inventory",
  })
})
