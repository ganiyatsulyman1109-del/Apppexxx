
export function generateWhatsAppLink({
  customerName,
  customerEmail,
  orderNumber,
  productNames,
  orderTotal,
}: {
  customerName: string
  customerEmail?: string
  orderNumber: string
  productNames: string
  orderTotal: number
}): string {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '2348000000000'
  const emailPart = customerEmail ? ` and email is ${customerEmail}` : ''
  const message = encodeURIComponent(
    `Hello Joebek Auto-mart, my name is ${customerName}${emailPart}. ` +
    `I purchased ${productNames} ` +
    `for ₦${orderTotal.toLocaleString('en-NG')}. ` +
    `My order ID is ${orderNumber}. What is the next step?`
  )
  return `https://wa.me/${phone}?text=${message}`
}
