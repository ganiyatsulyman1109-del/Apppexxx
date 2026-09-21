import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/utils/supabase"
import { requireAdminAuth } from '@/lib/auth'
import { revalidatePath } from "next/cache"
import { ECOMMERCE_PRODUCTS } from "@/lib/ecommerce-mock-data"

export const dynamic = 'force-dynamic'

function getFilteredMockProducts(searchParams: URLSearchParams) {
  const category = searchParams.get('category')
  const brand = searchParams.get('brand')
  const featured = searchParams.get('featured')
  const minPrice = searchParams.get('minPrice') || searchParams.get('min_price')
  const maxPrice = searchParams.get('maxPrice') || searchParams.get('max_price')
  const search = searchParams.get('search')?.toLowerCase()
  const sort = searchParams.get('sort')

  let list = [...ECOMMERCE_PRODUCTS]

  if (category) {
    list = list.filter(p => p.category.toLowerCase() === category.toLowerCase())
  }
  if (brand) {
    const brands = brand.split(',').map(b => b.trim().toLowerCase())
    list = list.filter(p => brands.includes(p.brand.toLowerCase()))
  }
  if (featured === 'true') {
    list = list.filter(p => p.featured)
  }
  if (minPrice) {
    const min = parseInt(minPrice)
    if (!isNaN(min)) list = list.filter(p => p.price >= min)
  }
  if (maxPrice) {
    const max = parseInt(maxPrice)
    if (!isNaN(max)) list = list.filter(p => p.price <= max)
  }
  if (search) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(search) ||
      (p.description && p.description.toLowerCase().includes(search)) ||
      p.brand.toLowerCase().includes(search) ||
      p.sku.toLowerCase().includes(search)
    )
  }

  if (sort === 'price_asc') {
    list.sort((a, b) => a.price - b.price)
  } else if (sort === 'price_desc') {
    list.sort((a, b) => b.price - a.price)
  } else if (sort === 'newest') {
    // Keep order
  } else if (sort === 'popular') {
    list.sort((a, b) => (b.stock || 0) - (a.stock || 0))
  }

  return list
}

// GET all products - public route
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder')) {
      return NextResponse.json({ products: getFilteredMockProducts(searchParams) }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      })
    }

    // Use server client for public GET requests
    const supabase = createAdminSupabaseClient()
    
    // Get URL parameters
    const category = searchParams.get('category')
    const brand = searchParams.get('brand')
    const featured = searchParams.get('featured')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') // 'price_asc', 'price_desc', 'newest', 'popular'
    
    // Build query
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
    
    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }
    
    if (brand) {
      query = query.eq('brand', brand)
    }
    
    if (featured === 'true') {
      query = query.eq('featured', true)
    }
    
    if (minPrice) {
      query = query.gte('price', parseInt(minPrice))
    }
    
    if (maxPrice) {
      query = query.lte('price', parseInt(maxPrice))
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }
    
    // Apply sorting
    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true })
        break
      case 'price_desc':
        query = query.order('price', { ascending: false })
        break
      case 'newest':
        query = query.order('created_at', { ascending: false })
        break
      case 'popular':
        // Sort by units_sold descending
        query = query.order('units_sold', { ascending: false })
        break
      default:
        query = query.order('name', { ascending: true })
    }
    
    const { data, error } = await query
    
    if (error) {
      console.warn('Supabase query error, falling back to mock products:', error);
      return NextResponse.json({ products: getFilteredMockProducts(searchParams) }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      })
    }
    
    // Map database fields to frontend expected format
    const mappedProducts = data?.map((product: any) => ({
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
      created_at: product.created_at
    })) || []
    
    return NextResponse.json({ products: mappedProducts }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
    
  } catch (error) {
    console.warn('GET /api/products exception, falling back to mock products:', error)
    return NextResponse.json({ products: getFilteredMockProducts(request.nextUrl.searchParams) }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  }
}

// POST create product - admin only
export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Database service not configured' },
        { status: 500 }
      )
    }
    
    // Require admin authentication
    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminSupabaseClient()
    
    const body = await request.json()
    const { name, sku, category, price, stock, description, brand, image_url, barcode, cost_price, threshold, featured } = body
    
    // Validate required fields
    if (!name || !sku || !category) {
      return NextResponse.json({ error: 'Name, SKU, and category are required' }, { status: 400 })
    }
    
    if (price === undefined || price === null || Number(price) <= 0) { 
      return NextResponse.json( 
        { error: 'Price must be a positive number' }, 
        { status: 400 } 
      ) 
    } 
    
    if (cost_price !== undefined && cost_price !== null && Number(cost_price) < 0) { 
      return NextResponse.json( 
        { error: 'Cost cannot be negative' }, 
        { status: 400 } 
      ) 
    } 
    
    const { data: existingSku } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .single()
    
    if (existingSku) {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 400 })
    }
    
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name,
        sku,
        category,
        price: Number(price),
        stock: stock ? Number(stock) : 0,
        description: description || '',
        brand: brand || '',
        image_url: image_url || '',
        barcode: barcode || '',
        cost_price: cost_price ? Number(cost_price) : 0,
        threshold: threshold ? Number(threshold) : 10,
        featured: featured || false,
        is_active: true,
        units_sold: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (productError) {
      console.error(productError);
      return NextResponse.json(
        { error: 'An internal error occurred. Please try again.' },
        { status: 500 }
      )
    }
    
    if (stock && Number(stock) > 0) {
      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert({
          product_id: product.id,
          change_type: 'adjustment',
          quantity_change: Number(stock),
          previous_stock: 0,
          new_stock: Number(stock),
          notes: 'Initial stock entry',
          created_by: authResult.user.id,
          created_at: new Date().toISOString(),
        })
      
      if (logError) {
        console.error('Failed to create inventory log:', logError)
      }
    }
    
    revalidatePath('/admin/products')
    revalidatePath('/admin/inventory')

    return NextResponse.json({ product }, { status: 201 })
    
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
