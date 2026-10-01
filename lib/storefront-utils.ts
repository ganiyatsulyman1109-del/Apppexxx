export type PublicBusinessConfig = {
  id: string
  name: string
  slug: string
  tagline: string | null
  logo_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  font_family: string
  personality: string
  layout_style: string
  whatsapp_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  country: string
  bank_name: string | null
  account_number: string | null
  account_name: string | null
  accept_bank_transfer: boolean
  accept_card_payment: boolean
  currency: string
  currency_symbol: string
  categories: string[]
  is_published: boolean
}

export type StoreProduct = {
  id: string
  name: string
  description: string | null
  brand: string | null
  category: string
  price: number
  images: string[]
  featured: boolean
  stock: number
  sku: string | null
}

export function generateWhatsAppLink(
  phoneNumber: string,
  message: string
): string {
  const cleaned = phoneNumber.replace(/\D/g, '')
  const withCountry = cleaned.startsWith('0')
    ? '234' + cleaned.slice(1)
    : cleaned.startsWith('234')
      ? cleaned
      : '234' + cleaned
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
}

export function generateProductMessage(
  businessName: string,
  productName: string,
  price: number,
  symbol: string
): string {
  return `Hello ${businessName}! I'm interested in *${productName}* listed at ${symbol}${price.toLocaleString()}. Is it available?`
}

export function generateEnquiryMessage(
  businessName: string
): string {
  return `Hello ${businessName}! I found you on Apex Enterprise and I'd like to learn more about your products.`
}

export function formatPrice(
  amount: number,
  symbol: string = '₦'
): string {
  if (amount > 0 && amount < 0.01) {
    return symbol + amount.toFixed(8)
      .replace(/\.?0+$/, '')
  }
  return symbol + amount.toLocaleString(
    'en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  )
}

export function getStockStatus(
  stock: number,
  threshold: number = 5
): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (stock <= 0) return 'out_of_stock'
  if (stock <= threshold) return 'low_stock'
  return 'in_stock'
}
