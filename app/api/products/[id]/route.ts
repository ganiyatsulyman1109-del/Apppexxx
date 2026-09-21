import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/utils/supabase"
import { requireAdminAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { ECOMMERCE_PRODUCTS } from "@/lib/ecommerce-mock-data"

// GET single product - public route
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder')) {
      const mockProduct = ECOMMERCE_PRODUCTS.find(p => p.id === id || p.sku === id)
      if (mockProduct) {
        return NextResponse.json({ product: mockProduct })
      }
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const supabase = createServerSupabaseClient()
    
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        const mockProduct = ECOMMERCE_PRODUCTS.find(p => p.id === id || p.sku === id)
        if (mockProduct) {
          return NextResponse.json({ product: mockProduct })
        }
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      console.warn('Supabase product query error, attempting mock fallback:', error);
      const mockProduct = ECOMMERCE_PRODUCTS.find(p => p.id === id || p.sku === id)
      if (mockProduct) {
        return NextResponse.json({ product: mockProduct })
      }
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    if (!product) {
      const mockProduct = ECOMMERCE_PRODUCTS.find(p => p.id === id || p.sku === id)
      if (mockProduct) {
        return NextResponse.json({ product: mockProduct })
      }
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    // Map database fields to frontend expected format
    const mappedProduct = {
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      category: product.category,
      image: product.image_url, // Map image_url to image
      images: product.images || [], // Include images array
      description: product.description,
      featured: product.featured,
    }
    
    return NextResponse.json({ product: mappedProduct })
    
  } catch (error) {
    console.warn('GET /api/products/[id] exception, attempting mock fallback:', error)
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
}

// PUT update product - admin only
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
    const auth = await requireAdminAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const supabase = createAdminSupabaseClient()
    const { id } = await params
    const body = await request.json()

    if (body.price !== undefined) {
      if (!body.price || Number(body.price) <= 0) { 
        return NextResponse.json( 
          { error: 'Price must be a positive number' }, 
          { status: 400 } 
        ) 
      }
    }
    if (body.cost_price !== undefined && Number(body.cost_price) < 0) { 
      return NextResponse.json( 
        { error: 'Cost cannot be negative' }, 
        { status: 400 } 
      ) 
    } 

    // 1. Get current product to check stock change
    const { data: currentProduct, error: getError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (getError || !currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const oldStock = currentProduct.stock
    const newStock = body.stock !== undefined ? body.stock : oldStock

    // 2. Update product
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        name: body.name,
        brand: body.brand,
        description: body.description,
        price: body.price,
        cost_price: body.cost_price,
        stock: newStock,
        threshold: body.threshold,
        category: body.category,
        sku: body.sku,
        image_url: body.image_url || body.image,
        images: body.images,
        featured: body.featured,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error(updateError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    // 3. Log stock change if it occurred
    if (newStock !== oldStock) {
      await supabase.from('inventory_logs').insert({
        product_id: id,
        change_amount: newStock - oldStock,
        previous_stock: oldStock,
        new_stock: newStock,
        reason: body.reason || 'Admin manual update',
        performed_by: auth.user.id
      })
    }

    revalidatePath('/admin/products')
    revalidatePath('/admin/inventory')

    return NextResponse.json({ product: updatedProduct })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE soft delete product - admin only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
    const auth = await requireAdminAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const supabase = createAdminSupabaseClient()
    const { id } = await params

    const { error } = await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({ success: true, message: 'Product deactivated successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
