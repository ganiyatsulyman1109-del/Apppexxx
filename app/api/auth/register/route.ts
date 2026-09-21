import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/utils/supabase'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown'

  try {
    const supabase = createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient()

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString() 
    const { count } = await adminSupabase 
      .from('rate_limits') 
      .select('*', { count: 'exact', head: true }) 
      .eq('ip_address', ip) 
      .eq('action', 'register') 
      .gte('created_at', fifteenMinutesAgo) 
    
    if (count && count >= 5) { 
      return NextResponse.json( 
        { error: 'Too many attempts. Please try again in 15 minutes.' }, 
        { status: 429 } 
      ) 
    } 
    
    await adminSupabase.from('rate_limits').insert({ 
      ip_address: ip, 
      action: 'register', 
      created_at: new Date().toISOString() 
    })
    
    const body = await request.json()
    const { email, password, full_name, phone } = body
    
    // Check if email already exists first
    const { data: existingUser } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
      
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered. Please login instead.' },
        { status: 400 }
      )
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    
    // Create user with admin client to bypass email confirmation
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone
      }
    })
    
    if (authError) {
      console.error(authError);
      if (authError.message?.toLowerCase().includes('already registered') || 
          authError.message?.toLowerCase().includes('already been registered') || 
          authError.message?.toLowerCase().includes('duplicate') || 
          authError.status === 422) { 
        return NextResponse.json( 
          { error: 'An account with this email already exists. Please log in instead.' }, 
          { status: 400 } 
        ) 
      } 
      return NextResponse.json( 
        { error: 'Failed to create account. Please try again.' }, 
        { status: 400 } 
      ) 
    }
    
    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 400 })
    }

    // Check if customer record exists
    const { data: existingCustomer } = await adminSupabase
      .from('customers')
      .select('id, user_id, full_name')
      .eq('email', email)
      .maybeSingle()

    let customerData
    let customerError

    if (existingCustomer) {
      // Customer exists - always update user_id unconditionally
      const { data, error } = await adminSupabase
        .from('customers')
        .update({
          user_id: authData.user.id,
          full_name: full_name || existingCustomer.full_name,
          updated_at: new Date().toISOString()
        })
        .eq('email', email)
        .select()
        .single()
      
      customerData = data
      customerError = error
    } else {
      // Create new customer record
      const { data, error } = await adminSupabase
        .from('customers')
        .insert([{
          user_id: authData.user.id,
          full_name: full_name || email.split('@')[0],
          email,
          phone,
          total_orders: 0,
          total_spent: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()
      
      customerData = data
      customerError = error
    }
    
    // Ensure user_id is linked to customer record for ALL cases
    // This is critical for orders made before registration to be properly linked
    await adminSupabase.from('customers')
      .update({
        user_id: authData.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)

    if (customerError) {
      // If we failed to handle customer record, we should ideally rollback auth user creation
      // But only if we just created it. Since signUp might have just logged in an existing user 
      // (Supabase behavior depends on config), we should be careful.
      // For now, we'll return error but not delete auth user to avoid deleting existing accounts.
      console.error('Customer record error:', customerError)
      console.error(customerError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    // Create user role if not exists
    const { data: existingRole } = await adminSupabase
      .from('user_roles')
      .select('id')
      .eq('user_id', authData.user.id)
      .maybeSingle()
      
    if (!existingRole) {
      const { error: roleError } = await adminSupabase
        .from('user_roles')
        .insert([{
          user_id: authData.user.id,
          role: 'customer'
        }])
      
      if (roleError) {
        console.error('Role creation error:', roleError)
        // Non-critical, user just won't have explicit role yet
      }
    }
    
    return NextResponse.json({
      message: 'Account created successfully',
      customer: customerData
    })
  } catch (error: any) {
    console.error('Registration catch block error:', error)
    
    // Check for duplicate key violation explicitly
    if (error?.message?.includes('duplicate') || error?.code === '23505') {
      return NextResponse.json(
        { error: 'Email already registered. Please login instead.' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
