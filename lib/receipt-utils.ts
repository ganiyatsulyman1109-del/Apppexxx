/**
 * Generate receipt number in format REC-YYYYMMDD-XXXX
 * Where XXXX is a 4-digit sequence number starting from 0001
 */
export function generateReceiptNumber(date: Date, sequence: number): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const sequenceStr = sequence.toString().padStart(4, '0')
  
  return `REC-${year}${month}${day}-${sequenceStr}`
}

/**
 * Extract sequence number from receipt number
 */
export function extractSequenceFromReceipt(receiptNumber: string): number {
  const match = receiptNumber.match(/REC-\d{8}-(\d{4})/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Get date from receipt number
 */
export function getDateFromReceipt(receiptNumber: string): Date | null {
  const match = receiptNumber.match(/REC-(\d{4})(\d{2})(\d{2})-\d{4}/)
  if (!match) return null
  
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10) - 1 // Months are 0-indexed
  const day = parseInt(match[3], 10)
  
  return new Date(year, month, day)
}