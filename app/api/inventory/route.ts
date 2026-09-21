import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/utils/supabase'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    const body = await request.json()
    const { product_id, action, quantity_change, reason, reference_id } = body
    
    if (!product_id || !action || !quantity_change) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Get current product stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', product_id)
      .single()
    
    if (productError) {
      console.error(productError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    const quantity_before = product.stock
    const quantity_after = action === 'restock' ? quantity_before + quantity_change : quantity_before - quantity_change
    
    if (quantity_after < 0) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    }
    
    // Create inventory log
    const { data, error } = await supabase
      .from('inventory_logs')
      .insert([{
        product_id,
        action,
        quantity_change,
        quantity_before,
        quantity_after,
        reason,
        reference_id,
        performed_by: '00000000-0000-0000-0000-000000000000' // Will be replaced with actual user ID
      }])
      .select()
      .single()
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    revalidatePath('/admin/inventory')
    revalidatePath('/admin/products')
    
    return NextResponse.json({ inventory_log: data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    const { searchParams } = new URL(request.url)
    const product_id = searchParams.get('product_id')
    const action = searchParams.get('action')
    const limit = searchParams.get('limit') || '50'
    
    let query = supabase
      .from('inventory_logs')
      .select(`*, products(name, sku)`)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (product_id) {
      query = query.eq('product_id', product_id)
    }
    
    if (action) {
      query = query.eq('action', action)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ inventory_logs: data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}