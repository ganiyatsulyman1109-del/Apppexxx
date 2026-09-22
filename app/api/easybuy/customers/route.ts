import { NextRequest, NextResponse } from 'next/server'
import { requireStaffOrAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { sendEasybuyWelcome } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminClient()
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const limit = searchParams.get('limit') || '10000'
    
    let query = supabase
      .from('easybuy_customers')
      .select(`
        *,
        staff:registered_by(full_name),
        total_purchases,
        total_payments,
        current_debt,
        credit_limit
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,easybuy_id.ilike.%${search}%`)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ customers: data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireStaffOrAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminClient()
    
    const body = await request.json()
    const {
      full_name,
      phone,
      email,
      address,
      city,
      state,
      date_of_birth,
      occupation,
      employer,
      monthly_income,
      // id_type,
      // id_number,
      // guarantor_name, // Removed from destructuring
      // guarantor_phone, // Removed from destructuring
      // guarantor_relationship, // Removed from destructuring
      credit_limit,
      registered_by,
      // photo_url,
      // id_photo_url
    } = body
    
    if (!full_name || !phone) {
      return NextResponse.json({ error: 'Full name and phone are required' }, { status: 400 })
    }

    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    if (normalizedEmail) {
      const { data: existingEmail } = await supabase 
        .from('easybuy_customers') 
        .select('easybuy_id') 
        .eq('email', normalizedEmail) 
        .maybeSingle() 

      if (existingEmail) { 
        return NextResponse.json( 
          { error: 'A customer with this email already exists.' }, 
          { status: 409 } 
        ) 
      } 
    }
    
    // Check if phone number already exists
    const { data: existingCustomer } = await supabase
      .from('easybuy_customers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()
    
    if (existingCustomer) {
      return NextResponse.json({ error: 'A customer with this phone number already exists' }, { status: 400 })
    }
    
    // Generate EasyBuy ID
    const easybuy_id = await generateEasyBuyId(supabase)
    const resolvedRegisteredBy = await resolveStaffUuid(supabase, registered_by || authResult.user.id)
    
    const { data, error } = await supabase
          .from('easybuy_customers')
          .insert([{
            easybuy_id,
            full_name,
            phone,
            email: normalizedEmail,
            address,
            city,
            state,
            date_of_birth,
            occupation,
            employer,
            monthly_income,
            // id_type, // Removed as column doesn't exist in schema
            // id_number, // Removed as column doesn't exist in schema
            // guarantor_name, // Removed as column doesn't exist in schema
            // guarantor_phone, // Removed as column doesn't exist in schema
            // guarantor_relationship, // Removed as column doesn't exist in schema
            credit_limit: credit_limit || 50000,
            registered_by: resolvedRegisteredBy,
            // photo_url, // Removed as column doesn't exist in schema
            // id_photo_url // Removed as column doesn't exist in schema
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

    // Send welcome email (fail silently)
    if (email) {
      try {
        // Get staff name if available
        let staffName = undefined
        if (resolvedRegisteredBy) {
          const { data: staff } = await supabase
            .from('staff')
            .select('full_name')
            .eq('id', resolvedRegisteredBy)
            .single()
          staffName = staff?.full_name
        }

        await sendEasybuyWelcome(
          full_name,
          email,
          easybuy_id,
          credit_limit || 50000,
          staffName
        )
      } catch (emailError) {
        console.error('Failed to send EasyBuy welcome email:', emailError)
      }
    }
    
    return NextResponse.json({ customer: data, easybuy_id })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function resolveStaffUuid(supabase: any, staffIdentifier?: string) {
  if (!staffIdentifier) return null

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffIdentifier)) {
    const { data } = await supabase
      .from('staff')
      .select('id')
      .eq('id', staffIdentifier)
      .maybeSingle()
    return data?.id || null
  }

  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', staffIdentifier.toUpperCase().trim())
    .maybeSingle()

  return data?.id || null
}

async function generateEasyBuyId(supabase: any): Promise<string> {
  const { data, error } = await supabase
    .rpc('generate_easybuy_id')
  
  if (error) {
    // Fallback to manual generation
    const { count } = await supabase
      .from('easybuy_customers')
      .select('*', { count: 'exact', head: true })
    
    const nextId = (count || 0) + 1
    return `EB${nextId.toString().padStart(6, '0')}`
  }
  
  return data
}
