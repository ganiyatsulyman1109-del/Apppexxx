import assert from "node:assert/strict"
import test from "node:test"
import { isValidCronAuthorization, isValidCronSecret } from "./cron-auth.ts"

test("cron authentication rejects a missing configured secret", () => {
  assert.equal(isValidCronSecret(undefined, "scheduled-secret"), false)
  assert.equal(isValidCronSecret("", "scheduled-secret"), false)
  assert.equal(isValidCronSecret("   ", "scheduled-secret"), false)
})

test("cron authentication rejects missing or incorrect credentials", () => {
  assert.equal(isValidCronSecret("scheduled-secret", null), false)
  assert.equal(isValidCronSecret("scheduled-secret", ""), false)
  assert.equal(isValidCronSecret("scheduled-secret", "incorrect"), false)
})

test("cron authentication accepts only an exact configured secret", () => {
  assert.equal(isValidCronSecret("scheduled-secret", "scheduled-secret"), true)
})

test("cron authorization accepts Vercel's bearer header and the existing secret header", () => {
  assert.equal(isValidCronAuthorization("scheduled-secret", null, "Bearer scheduled-secret"), true)
  assert.equal(isValidCronAuthorization("scheduled-secret", "scheduled-secret", null), true)
  assert.equal(isValidCronAuthorization("scheduled-secret", null, "Basic scheduled-secret"), false)
})
