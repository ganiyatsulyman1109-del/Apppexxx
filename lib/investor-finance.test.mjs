import test from "node:test"
import assert from "node:assert/strict"
import {
  calculateAnnualSimpleReturn,
  calculateInvestorAccrualDays,
  calculateInvestmentEndDate,
} from "./investor-finance.ts"

test("annual simple return prorates by day over a 365-day year", () => {
  assert.ok(Math.abs(calculateAnnualSimpleReturn(365000, 10, 365) - 36500) < 0.001)
  assert.equal(calculateAnnualSimpleReturn(365000, 10, 0), 0)
})

test("investment end date clamps month-end without rolling into the following month", () => {
  assert.equal(calculateInvestmentEndDate("2025-01-31", 1), "2025-02-28")
  assert.equal(calculateInvestmentEndDate("2024-01-31", 1), "2024-02-29")
})

test("accrual days exclude the investment start day and stop at term maturity", () => {
  const asOf = new Date("2025-01-06T12:00:00.000Z")
  assert.equal(calculateInvestorAccrualDays("2025-01-01", "2025-01-10", asOf), 5)
  assert.equal(calculateInvestorAccrualDays("2025-01-01", "2025-01-04", asOf), 3)
  assert.equal(calculateInvestorAccrualDays("2025-01-10", "2025-02-10", asOf), 0)
})
