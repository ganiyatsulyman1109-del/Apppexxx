import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'
import { sendEasybuyWelcome } from '@/lib/email'
import { getAuthBusinessId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }
    
    const supabase = createAdminClient()
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const requestedLimit = Number(searchParams.get('limit') || 10000)
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 })
    }
    const limit = Math.min(requestedLimit, 10000)
    
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
      .eq('business_id', businessId)
      .eq('staff.business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
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
    console.error('EasyBuy customer list failed:', error)
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

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
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
    
    if (typeof full_name !== 'string' || !full_name.trim() ||
        typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Full name and phone are required' }, { status: 400 })
    }
    if (email !== undefined && email !== null && typeof email !== 'string') {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    if (registered_by !== undefined && registered_by !== null && typeof registered_by !== 'string') {
      return NextResponse.json({ error: 'Invalid staff identifier' }, { status: 400 })
    }
    if (monthly_income !== undefined && monthly_income !== null &&
        (!Number.isFinite(Number(monthly_income)) || Number(monthly_income) < 0)) {
      return NextResponse.json({ error: 'Monthly income must be a non-negative number' }, { status: 400 })
    }
    const creditLimit = credit_limit === undefined ? 50000 : Number(credit_limit)
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      return NextResponse.json({ error: 'Credit limit must be a non-negative number' }, { status: 400 })
    }

    const normalizedEmail = email ? email.toLowerCase().trim() : null
    const normalizedName = full_name.trim()
    const normalizedPhone = phone.trim()
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (normalizedEmail) {
      const { data: existingEmail, error: emailLookupError } = await supabase
        .from('easybuy_customers') 
        .select('easybuy_id') 
        .eq('email', normalizedEmail) 
        .eq('business_id', businessId)
        .maybeSingle() 
      if (emailLookupError) {
        console.error('EasyBuy email lookup failed:', emailLookupError)
        return NextResponse.json({ error: 'Failed to validate customer details' }, { status: 500 })
      }

      if (existingEmail) { 
        return NextResponse.json( 
          { error: 'A customer with this email already exists.' }, 
          { status: 409 } 
        ) 
      } 
    }
    
    // Check if phone number already exists
    const { data: existingCustomer, error: phoneLookupError } = await supabase
      .from('easybuy_customers')
      .select('id')
      .eq('phone', normalizedPhone)
      .eq('business_id', businessId)
      .maybeSingle()
    if (phoneLookupError) {
      console.error('EasyBuy phone lookup failed:', phoneLookupError)
      return NextResponse.json({ error: 'Failed to validate customer details' }, { status: 500 })
    }
    
    if (existingCustomer) {
      return NextResponse.json({ error: 'A customer with this phone number already exists' }, { status: 400 })
    }
    
    // Generate EasyBuy ID
    const easybuy_id = await generateEasyBuyId(supabase, businessId)
    const resolvedRegisteredBy = await resolveStaffUuid(supabase, registered_by || authResult.user.id, businessId)
    
    const { data, error } = await supabase
          .from('easybuy_customers')
          .insert([{
            easybuy_id,
            business_id: businessId,
            full_name: normalizedName,
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
            credit_limit: creditLimit,
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
            .eq('business_id', businessId)
            .single()
          staffName = staff?.full_name
        }

        await sendEasybuyWelcome(
          normalizedName,
          email,
          easybuy_id,
          creditLimit,
          staffName
        )
      } catch (emailError) {
        console.error('Failed to send EasyBuy welcome email:', emailError)
      }
    }
    
    return NextResponse.json({ customer: data, easybuy_id })
  } catch (error) {
    console.error('EasyBuy customer creation failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function resolveStaffUuid(supabase: any, staffIdentifier?: string, businessId?: string) {
  if (!staffIdentifier) return null

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(staffIdentifier)) {
    const { data, error } = await supabase
      .from('staff')
      .select('id')
      .eq('id', staffIdentifier)
      .eq('business_id', businessId)
      .maybeSingle()
    if (error) throw new Error(`Failed to resolve staff: ${error.message}`)
    return data?.id || null
  }

  const { data, error } = await supabase
    .from('staff')
    .select('id')
    .eq('staff_id', staffIdentifier.toUpperCase().trim())
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw new Error(`Failed to resolve staff: ${error.message}`)

  return data?.id || null
}

async function generateEasyBuyId(supabase: any, businessId: string): Promise<string> {
  const { data, error } = await supabase
    .rpc('generate_easybuy_id')
  
  if (error) {
    console.warn('EasyBuy ID sequence unavailable; using tenant-scoped fallback:', error.message)
    // Fallback to manual generation
    const { count, error: countError } = await supabase
      .from('easybuy_customers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
    if (countError) throw new Error(`Failed to generate EasyBuy ID: ${countError.message}`)
    
    const nextId = (count || 0) + 1
    return `EB${nextId.toString().padStart(6, '0')}-${businessId.replace(/-/g, '').toUpperCase()}`
  }
  
  return data
}
