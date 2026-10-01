import { notFound } from "next/navigation"
import { ProductDetail } from "@/components/storefront/product-detail"
import { createAdminClient } from "@/lib/utils/supabase"
import type { StoreProduct } from "@/lib/storefront-utils"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}) {
  const { slug, productId } = await params
  if (!UUID_PATTERN.test(productId)) notFound()

  const supabase = createAdminClient()
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, slug, currency_symbol, whatsapp_number, is_active, is_published")
    .eq("slug", slug)
    .maybeSingle()
  if (businessError || !business || !business.is_active || !business.is_published) notFound()

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, description, brand, category, price, images, featured, stock, sku")
    .eq("id", productId)
    .eq("business_id", business.id)
    .eq("is_active", true)
    .maybeSingle()
  if (productError || !product) notFound()

  const storeProduct: StoreProduct = {
    ...product,
    description: product.description ?? null,
    brand: product.brand ?? null,
    images: product.images ?? [],
    featured: product.featured ?? false,
    sku: product.sku ?? null,
  }

  return <ProductDetail business={business} product={storeProduct} />
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}) {
  const { slug, productId } = await params
  if (!UUID_PATTERN.test(productId)) return { title: "Product" }

  const { data: business } = await createAdminClient()
    .from("businesses")
    .select("id, name, is_active, is_published")
    .eq("slug", slug)
    .maybeSingle()
  if (!business?.is_active || !business.is_published) return { title: "Product" }
  const { data: product } = await createAdminClient()
    .from("products")
    .select("name, description")
    .eq("id", productId)
    .eq("business_id", business.id)
    .eq("is_active", true)
    .maybeSingle()
  return { title: product?.name || "Product", description: product?.description || undefined }
}
