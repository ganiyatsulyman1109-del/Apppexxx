import { NextRequest, NextResponse } from 'next/server'
import { assertBelongsToBusiness, requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { sendEasybuyWelcome } from '@/lib/email'

export const dynamic = 'force-dynamic'

function authErrorResponse(error: unknown): Response | null {
  return error instanceof Response ? error : null
}

export async function GET(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: 'No business associated with account' }, { status: 403 })
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
      .eq('business_id', auth.businessId)
      .order('created_at', { ascending: false })
      .limit(parseLimit(limit))
    
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,easybuy_id.ilike.%${search}%`)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Failed to fetch EasyBuy customers:', error)
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }
    
    return NextResponse.json({ customers: data || [] })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('GET /api/easybuy/customers failed:', error)
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

    const auth = await requireAdminAuth()
    if (!auth.businessId) {
      return NextResponse.json({ error: 'No business associated with account' }, { status: 403 })
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
    
    if (typeof full_name !== 'string' || !full_name.trim() || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Full name and phone are required' }, { status: 400 })
    }

    const normalizedEmail = typeof email === 'string' && email.trim() ? email.toLowerCase().trim() : null;
    const normalizedPhone = phone.trim()
    const parsedCreditLimit = credit_limit === undefined ? 50000 : Number(credit_limit)
    if (!Number.isFinite(parsedCreditLimit) || parsedCreditLimit < 0) {
      return NextResponse.json({ error: 'Credit limit must be a non-negative number' }, { status: 400 })
    }

    if (normalizedEmail) {
      const { data: existingEmail, error: emailError } = await supabase
        .from('easybuy_customers') 
        .select('easybuy_id') 
        .eq('business_id', auth.businessId)
        .eq('email', normalizedEmail) 
        .maybeSingle() 

      if (emailError) {
        console.error('Failed to check EasyBuy customer email:', emailError)
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
      }
      if (existingEmail) { 
        return NextResponse.json( 
          { error: 'A customer with this email already exists.' }, 
          { status: 409 } 
        ) 
      } 
    }
    
    // Check if phone number already exists
    const { data: existingCustomer, error: phoneError } = await supabase
      .from('easybuy_customers')
      .select('id')
      .eq('business_id', auth.businessId)
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (phoneError) {
      console.error('Failed to check EasyBuy customer phone:', phoneError)
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
    }
    
    if (existingCustomer) {
      return NextResponse.json({ error: 'A customer with this phone number already exists' }, { status: 400 })
    }
    
    // Generate EasyBuy ID
    const easybuy_id = await generateEasyBuyId(supabase)
    const resolvedRegisteredBy = await resolveStaffUuid(
      supabase,
      auth.businessId,
      typeof registered_by === 'string' ? registered_by : null
    )
    
    const { data, error } = await supabase
          .from('easybuy_customers')
          .insert([{
            business_id: auth.businessId,
            easybuy_id,
            full_name,
            phone: normalizedPhone,
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
            credit_limit: parsedCreditLimit,
            registered_by: resolvedRegisteredBy,
            // photo_url, // Removed as column doesn't exist in schema
            // id_photo_url // Removed as column doesn't exist in schema
          }])
          .select()
          .single()
    
    if (error) {
      console.error('Failed to create EasyBuy customer:', error)
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
    }
    assertBelongsToBusiness(data.business_id, auth.businessId)

    // Send welcome email (fail silently)
    if (normalizedEmail) {
      try {
        // Get staff name if available
        let staffName = undefined
        if (resolvedRegisteredBy) {
          const { data: staff } = await supabase
            .from('staff')
            .select('full_name')
            .eq('id', resolvedRegisteredBy)
            .eq('business_id', auth.businessId)
            .single()
          staffName = staff?.full_name
        }

        await sendEasybuyWelcome(
          full_name,
          normalizedEmail,
          easybuy_id,
          parsedCreditLimit,
          staffName
        )
      } catch (emailError) {
        console.error('Failed to send EasyBuy welcome email:', emailError)
      }
    }
    
    return NextResponse.json({ success: true, customer: data, easybuy_id }, { status: 201 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error('POST /api/easybuy/customers failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function parseLimit(limit: string): number {
  const parsed = Number(limit)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 100
}

async function resolveStaffUuid(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  staffIdentifier?: string | null
) {
  if (!staffIdentifier) return null

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffIdentifier)) {
    const { data, error } = await supabase
      .from('staff')
      .select('id')
      .eq('id', staffIdentifier)
      .eq('business_id', businessId)
      .maybeSingle()
    if (error) throw error
    return data?.id || null
  }

  const { data, error } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', staffIdentifier.toUpperCase().trim())
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) throw error
  return data?.id || null
}

async function generateEasyBuyId(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data, error } = await supabase
    .rpc('generate_easybuy_id')
  
  if (error) {
    throw error
  }
  
  if (typeof data !== 'string' || !data) {
    throw new Error('EasyBuy ID generator returned an invalid identifier')
  }
  return data
}
