import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/utils/supabase"
import { requireAdminAuth } from "@/lib/auth"
import { notifyLowStock } from "@/lib/notifications"
import { revalidatePath } from "next/cache"

export async function PATCH(
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
    // Require admin authentication
    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 401 })
    }
    
    const supabase = createAdminSupabaseClient()
    const { id } = await params
    
    const body = await request.json()
    const { adjustment, reason } = body
    
    // Validate required fields
    if (adjustment === undefined || !reason) {
      return NextResponse.json({ error: 'Adjustment quantity and reason are required' }, { status: 400 })
    }
    
    const quantity_change = parseInt(String(adjustment), 10)
    if (isNaN(quantity_change)) {
        return NextResponse.json({ error: 'Invalid adjustment value' }, { status: 400 })
    }
    
    // Get current product data
    const { data: currentProduct, error: currentError } = await supabase
      .from('products')
      .select('stock, threshold, name')
      .eq('id', id)
      .single()
    
    if (currentError) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    const previousStock = currentProduct.stock
    const newStock = previousStock + quantity_change
    
    // Validate new stock is not negative
    if (newStock < 0) {
      return NextResponse.json({ error: 'New stock quantity cannot be negative' }, { status: 400 })
    }
    
    // Update product stock with optimistic concurrency
    const { data: product, error: productError } = await supabase
      .from('products')
      .update({ 
        stock: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('stock', previousStock)
      .select()
      .single()
    
    if (productError || !product) {
      return NextResponse.json({ error: 'Stock was updated concurrently by another user. Please try again.' }, { status: 409 })
    }
    
    // Create inventory log entry
    // Use correct columns from schema: change_type, quantity_change, previous_stock, new_stock, notes, created_by
    const { error: logError } = await supabase
      .from('inventory_logs')
      .insert({
        product_id: id,
        change_type: quantity_change > 0 ? 'restock' : 'adjustment',
        quantity_change: quantity_change,
        previous_stock: previousStock,
        new_stock: newStock,
        notes: reason,
        created_by: authResult.user!.id,
        created_at: new Date().toISOString(),
      })
    
    if (logError) {
      console.error('Failed to create inventory log:', logError)
    }
    
    if (newStock <= currentProduct.threshold) {
      await notifyLowStock({
        id,
        name: currentProduct.name,
        stock: newStock
      })
    }
    
    revalidatePath('/admin/inventory')
    revalidatePath('/admin/products')
    
    return NextResponse.json({ 
      product,
      stock_adjusted: {
        previous: previousStock,
        new: newStock,
        change: quantity_change
      }
    })
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
