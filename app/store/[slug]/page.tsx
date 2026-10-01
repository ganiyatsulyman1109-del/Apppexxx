import { notFound } from "next/navigation"
import { StorefrontWrapper } from "@/components/storefront/storefront-wrapper"

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/storefront/${slug}`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) notFound()

  const data = await res.json()
  if (!data.success) notFound()

  return (
    <StorefrontWrapper
      business={data.business}
      products={data.products}
      isPreview={data.is_preview}
    />
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/storefront/${slug}`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    return { title: "Store" }
  }

  const data = await res.json()

  return {
    title: data.business?.name || "Store",
    description: data.business?.tagline || `Shop at ${data.business?.name}`,
  }
}
