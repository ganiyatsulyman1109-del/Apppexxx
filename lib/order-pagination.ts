export interface OrderPage {
  limit: number
  offset: number
}

export function parseOrderPage(searchParams: URLSearchParams): OrderPage | null {
  const rawLimit = searchParams.get("limit")
  const rawOffset = searchParams.get("offset")
  const limit = rawLimit === null ? 50 : Number(rawLimit)
  const offset = rawOffset === null ? 0 : Number(rawOffset)

  if (
    (rawLimit !== null && !/^\d+$/.test(rawLimit)) ||
    (rawOffset !== null && !/^\d+$/.test(rawOffset)) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 1_000_000
  ) {
    return null
  }

  return { limit, offset }
}
