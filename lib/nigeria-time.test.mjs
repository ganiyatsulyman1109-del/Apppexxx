import assert from "node:assert/strict"
import test from "node:test"
import { getNigeriaDate, getPreviousNigeriaDayWindow } from "./nigeria-time.ts"

test("Nigeria date uses the Lagos timezone", () => {
  assert.equal(getNigeriaDate(new Date("2026-10-01T23:00:00.000Z")), "2026-10-02")
})

test("scheduled return processing uses the previous completed Lagos day", () => {
  const window = getPreviousNigeriaDayWindow(new Date("2026-10-01T23:00:00.000Z"))
  assert.equal(window.date, "2026-10-01")
  assert.equal(window.start.toISOString(), "2026-09-30T23:00:00.000Z")
  assert.equal(window.end.toISOString(), "2026-10-01T22:59:59.999Z")
})
