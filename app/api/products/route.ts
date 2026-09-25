import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/utils/supabase"
import { requireAdminAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const supabase = createAdminClient()
    const category = searchParams.get("category")
    const brand = searchParams.get("brand")
    const featured = searchParams.get("featured")
    const minPrice = searchParams.get("minPrice") || searchParams.get("min_price")
    const maxPrice = searchParams.get("maxPrice") || searchParams.get("max_price")
    const search = searchParams.get("search")
    const sort = searchParams.get("sort")

    let query = supabase
      .from("products")
      .select("*")
      .eq("business_id", auth.businessId)
      .eq("is_active", true)

    if (category) query = query.eq("category", category)
    if (brand) query = query.eq("brand", brand)
    if (featured === "true") query = query.eq("featured", true)
    if (minPrice) query = query.gte("price", Number(minPrice))
    if (maxPrice) query = query.lte("price", Number(maxPrice))
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)

    switch (sort) {
      case "price_asc":
        query = query.order("price", { ascending: true })
        break
      case "price_desc":
        query = query.order("price", { ascending: false })
        break
      case "newest":
        query = query.order("created_at", { ascending: false })
        break
      case "popular":
        query = query.order("units_sold", { ascending: false })
        break
      default:
        query = query.order("name", { ascending: true })
    }

    const { data, error } = await query
    if (error) {
      console.error("Failed to load business products:", error)
      return NextResponse.json({ error: "Failed to load products" }, { status: 500 })
    }

    const products = data.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      cost_price: product.cost_price,
      stock: product.stock,
      threshold: product.threshold,
      sku: product.sku,
      category: product.category,
      image: product.image_url,
      images: product.images || [],
      description: product.description,
      featured: product.featured,
      units_sold: product.units_sold,
      created_at: product.created_at,
    }))

    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("GET /api/products failed:", error)
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json(
        { error: "No business associated with account" },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const {
      name,
      sku,
      category,
      price,
      stock,
      description,
      brand,
      image_url,
      barcode,
      cost_price,
      threshold,
      featured,
    } = body

    if (!name || !sku || !category) {
      return NextResponse.json(
        { error: "Name, SKU, and category are required" },
        { status: 400 }
      )
    }

    if (price === undefined || price === null || !Number.isFinite(Number(price)) || Number(price) <= 0) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 })
    }

    if (cost_price !== undefined && cost_price !== null && (!Number.isFinite(Number(cost_price)) || Number(cost_price) < 0)) {
      return NextResponse.json({ error: "Cost cannot be negative" }, { status: 400 })
    }

    const { data: existingSku, error: skuError } = await supabase
      .from("products")
      .select("id")
      .eq("business_id", auth.businessId)
      .eq("sku", sku)
      .maybeSingle()

    if (skuError) {
      console.error("Failed to check product SKU:", skuError)
      return NextResponse.json({ error: "Failed to validate product SKU" }, { status: 500 })
    }
    if (existingSku) {
      return NextResponse.json({ error: "SKU already exists" }, { status: 400 })
    }

    const initialStock = stock === undefined || stock === null || stock === "" ? 0 : Number(stock)
    if (!Number.isInteger(initialStock) || initialStock < 0) {
      return NextResponse.json({ error: "Stock must be a non-negative whole number" }, { status: 400 })
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        business_id: auth.businessId,
        name,
        sku,
        category,
        price: Number(price),
        stock: initialStock,
        description: description || "",
        brand: brand || "",
        image_url: image_url || "",
        barcode: barcode || "",
        cost_price: cost_price === undefined || cost_price === null ? 0 : Number(cost_price),
        threshold: threshold === undefined || threshold === null ? 10 : Number(threshold),
        featured: Boolean(featured),
        is_active: true,
        units_sold: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (productError || !product) {
      console.error("Failed to create product:", productError)
      return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
    }

    if (initialStock > 0) {
      const { error: logError } = await supabase.from("inventory_logs").insert({
        business_id: auth.businessId,
        product_id: product.id,
        change_type: "adjustment",
        quantity_change: initialStock,
        previous_stock: 0,
        new_stock: initialStock,
        notes: "Initial stock entry",
        created_by: auth.userId,
        created_at: new Date().toISOString(),
      })

      if (logError) {
        console.error("Product created but initial inventory log failed:", logError)
        return NextResponse.json(
          { error: "Product was created, but its initial inventory log could not be recorded" },
          { status: 500 }
        )
      }
    }

    revalidatePath("/admin/products")
    revalidatePath("/admin/inventory")
    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("POST /api/products failed:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
