import { timingSafeEqual } from "node:crypto"

export function isValidCronSecret(configuredSecret: string | undefined, suppliedSecret: string | null): boolean {
  if (!configuredSecret?.trim() || !suppliedSecret) return false

  const expected = Buffer.from(configuredSecret, "utf8")
  const supplied = Buffer.from(suppliedSecret, "utf8")
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
}

export function isValidCronAuthorization(
  configuredSecret: string | undefined,
  cronSecretHeader: string | null,
  authorizationHeader: string | null,
): boolean {
  const bearerSecret = authorizationHeader?.match(/^Bearer (.+)$/i)?.[1] ?? null
  return isValidCronSecret(configuredSecret, cronSecretHeader)
    || isValidCronSecret(configuredSecret, bearerSecret)
}
