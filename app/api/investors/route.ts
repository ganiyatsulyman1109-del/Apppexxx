import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/utils/supabase'
import { calculateTotalReturns } from '@/lib/investor-types'
import { requireAdminAuth } from '@/lib/auth'
import { getAuthBusinessId } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

function toNigeriaDateString(utcTimestamp: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    return formatter.format(new Date(utcTimestamp))
  } catch {
    const date = new Date(utcTimestamp)
    const nigeriaOffset = 60 * 60 * 1000 // UTC+1
    const nigeriaTime = new Date(date.getTime() + nigeriaOffset)
    return nigeriaTime.toISOString().split('T')[0]
  }
}

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
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }

    const supabase = createAdminClient()
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const requestedLimit = Number(searchParams.get('limit') || 50)
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return NextResponse.json({ error: 'Invalid limit' }, { status: 400 })
    }
    const limit = Math.min(requestedLimit, 200)
    if (status && !['active', 'paused', 'completed', 'matured', 'withdrawn'].includes(status)) {
      return NextResponse.json({ error: 'Invalid investor status' }, { status: 400 })
    }
    
    let query = supabase
      .from('investors')
      .select(`*`)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
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
    
    const investors = []
    
    // Process investors and sync returns
    // This ensures that even if the cron job fails, returns are calculated correctly when viewed
    const adminSupabase = createAdminClient()
    const updatePromises: PromiseLike<{ error: unknown }>[] = []

    // Pre-fetch all necessary data to avoid N+1 queries in the loop.
    // 1. Find the earliest investment date among all active investors
    const activeInvestors = (data || []).filter(inv => inv.status === 'active' && inv.investment_date)
    let earliestDate: string | null = null
    
    if (activeInvestors.length > 0) {
      earliestDate = activeInvestors.reduce((min, inv) => {
        return !min || inv.investment_date < min ? inv.investment_date : min
      }, null as string | null)
    }

    let allPaidOrders: any[] = []
    let allEasybuyPayments: any[] = []

    if (earliestDate) {
      const fetchAllDates = async (table: string, statusFilter?: {column: string, value: string}) => {
        let results: any[] = []
        let hasMore = true
        let offset = 0
        const limit = 1000
        
        while (hasMore) {
          let q = adminSupabase
            .from(table)
            .select('created_at')
            .eq('business_id', businessId)
            .gt('created_at', earliestDate)
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1)
            
          if (statusFilter) {
            q = q.eq(statusFilter.column, statusFilter.value)
          }
          
          const { data, error } = await q
          if (error) throw new Error(`Failed to load business activity: ${error.message}`)
          if (data && data.length > 0) {
            results = results.concat(data)
            offset += limit
            if (data.length < limit) hasMore = false
          } else {
            hasMore = false
          }
        }
        return results
      }

      const [paidOrders, easybuyPayments] = await Promise.all([
        fetchAllDates('orders', { column: 'status', value: 'delivered' }),
        fetchAllDates('easybuy_payments')
      ])
      
      allPaidOrders = paidOrders || []
      allEasybuyPayments = easybuyPayments || []
    }
    
    for (const inv of (data || [])) {
        const currentInv = { ...inv }

        if (currentInv.status === 'active' && currentInv.investment_date && currentInv.investment_amount && currentInv.daily_return_rate) {
            // Calculate earning days from actual paid orders and easybuy_payments
            const investmentDateStr = toNigeriaDateString(currentInv.investment_date)
            
            // Filter pre-fetched data for this specific investor
            const investorPaidOrders = allPaidOrders.filter(o => o.created_at > currentInv.investment_date)
            const investorEbPayments = allEasybuyPayments.filter(p => p.created_at > currentInv.investment_date)
            
            // Count unique days when sales occurred (only days after investment_date)
            const uniqueSalesDays = new Set<string>()
            
            investorPaidOrders.forEach(order => {
              const orderDate = toNigeriaDateString(order.created_at)
              if (orderDate > investmentDateStr) {
                uniqueSalesDays.add(orderDate)
              }
            })
            
            investorEbPayments.forEach(payment => {
              const paymentDate = toNigeriaDateString(payment.created_at)
              if (paymentDate > investmentDateStr) {
                uniqueSalesDays.add(paymentDate)
              }
            })
            
            const salesDays = uniqueSalesDays.size
            
            // Only calculate if days > 0
            if (salesDays > 0) {
                const expectedTotalEarned = calculateTotalReturns(
                    Number(currentInv.investment_amount), 
                    Number(currentInv.daily_return_rate), 
                    salesDays
                )
                
                const currentTotalEarned = Number(currentInv.total_returns_earned || 0)
                const currentTotalPaid = Number(currentInv.total_returns_paid || 0)
                
                // Logic:
                // Total Earned should be strictly based on time passed.
                // Current Balance = Total Earned - Total Paid
                
                // If the stored total_returns_earned is less than expected (meaning time has passed), update it.
                if (expectedTotalEarned > currentTotalEarned) {
                        
                        // Recalculate balance based on new total earned
                        const newBalance = expectedTotalEarned - currentTotalPaid
                        
                        // Update local object for response immediately
                        currentInv.total_returns_earned = expectedTotalEarned
                        currentInv.current_balance = Math.max(0, newBalance)
                        
                        // Queue DB update
                        updatePromises.push(
                            adminSupabase.from('investors').update({
                                total_returns_earned: expectedTotalEarned,
                                current_balance: Math.max(0, newBalance),
                                updated_at: new Date().toISOString()
                            }).eq('id', currentInv.id).eq('business_id', businessId)
                            .then(({ error }) => ({ error }))
                        )
                }
            }
        }
        
        investors.push({
            ...currentInv,
            name: currentInv.full_name,
            principal_amount: currentInv.investment_amount,
            return_rate: currentInv.daily_return_rate,
            start_date: currentInv.investment_date
        })
    }
    
    if (updatePromises.length > 0) {
        // We don't await this to keep the response fast, or we can await if we want to be sure
        // Given this is an admin view, awaiting is safer to ensure consistency
        const updateResults = await Promise.all(updatePromises)
        const failedUpdate = updateResults.find(result => result.error)
        if (failedUpdate) {
          console.error('Failed to sync investor returns:', failedUpdate.error)
          return NextResponse.json({ error: 'Failed to update investor returns' }, { status: 500 })
        }
    }

    return NextResponse.json({ investors }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (error) {
    console.error("Error fetching investors:", error)
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
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
    }
    const businessId = await getAuthBusinessId(authResult)
    if (!businessId) {
      return NextResponse.json({ error: 'Business context not found' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }
    const {
      full_name,
      name,
      email,
      phone,
      tenure_months,
      password
    } = body
    const principalAmount = Number(body.principal_amount ?? body.investment_amount)
    const returnRate = Number(body.return_rate ?? body.daily_return_rate)
    const tenureMonths = Number(tenure_months ?? 12)
    const startDateValue = body.start_date ?? body.investment_date
    const startDateString = typeof startDateValue === 'string' ? startDateValue : ''
    const parsedInvestmentDate = new Date(`${startDateString}T00:00:00.000Z`)
    
    const resolvedFullName = full_name || name
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : ''
    if (typeof resolvedFullName !== 'string' || !resolvedFullName.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
        !Number.isFinite(principalAmount) || principalAmount <= 0 ||
        !Number.isFinite(returnRate) || returnRate <= 0 || returnRate > 5 ||
        !Number.isInteger(tenureMonths) || tenureMonths < 1 || tenureMonths > 600 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(startDateString) ||
        typeof password !== 'string' || !password ||
        Number.isNaN(parsedInvestmentDate.getTime()) ||
        parsedInvestmentDate.toISOString().slice(0, 10) !== startDateString) {
      return NextResponse.json({
        error: 'Valid name, email, positive principal, return rate (up to 5%), tenure (1-600 months), start date, and password are required'
      }, { status: 400 })
    }
    const expectedMaturityDate = new Date(parsedInvestmentDate)
    const originalDay = expectedMaturityDate.getUTCDate()
    expectedMaturityDate.setUTCDate(1)
    expectedMaturityDate.setUTCMonth(expectedMaturityDate.getUTCMonth() + tenureMonths)
    const lastDayOfMaturityMonth = new Date(
      Date.UTC(expectedMaturityDate.getUTCFullYear(), expectedMaturityDate.getUTCMonth() + 1, 0)
    ).getUTCDate()
    expectedMaturityDate.setUTCDate(Math.min(originalDay, lastDayOfMaturityMonth))
    
    // Use password from frontend
    const tempPassword = password
    
    // Use Admin client for user creation
    const adminSupabase = createAdminClient()
    
    // Check if investor with this email already exists
    const { data: existingInvestorRecord, error: existingInvestorError } = await adminSupabase
      .from('investors')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('business_id', businessId)
      .maybeSingle()
    if (existingInvestorError) {
      console.error('Failed to check investor email:', existingInvestorError)
      return NextResponse.json({ error: 'Failed to validate investor details' }, { status: 500 })
    }

    if (existingInvestorRecord) {
      return NextResponse.json({ error: 'An investor with this email is already registered.' }, { status: 400 })
    }

    // Check if profile already exists for this email
    const { data: existingProfile, error: profileLookupError } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('business_id', businessId)
      .maybeSingle()
    if (profileLookupError) {
      console.error('Failed to check investor profile:', profileLookupError)
      return NextResponse.json({ error: 'Failed to validate investor details' }, { status: 500 })
    }

    let userId: string

    if (existingProfile) {
      userId = existingProfile.id
      // Profile exists, we don't need to create user/profile again
      // We just need to ensure they have the investor role
    } else {
      // Create Supabase auth user for the investor
    const { data: authData, error: userCreationError } = await adminSupabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      ...(normalizedPhone ? { phone: normalizedPhone, phone_confirm: true } : {}),
      user_metadata: {
        full_name: resolvedFullName,
        name: resolvedFullName,
        role: 'investor'
      }
    })

      if (userCreationError) {
        console.error(userCreationError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
      }

      userId = authData.user.id

    }

    const { data: tenantProfile, error: tenantProfileError } = await adminSupabase
      .from('profiles')
      .update({ business_id: businessId })
      .eq('id', userId)
      .or(`business_id.is.null,business_id.eq.${businessId}`)
      .select('id')
      .maybeSingle()
    if (tenantProfileError || !tenantProfile) {
      if (!existingProfile) await adminSupabase.auth.admin.deleteUser(userId)
      console.error('Failed to associate investor profile with business:', tenantProfileError)
      return NextResponse.json({ error: 'Failed to associate investor with business' }, { status: 500 })
    }

    // Assign role (upsert to handle if role already exists or user has other roles)
    // Note: If user already has a role, this might fail depending on unique constraint on (user_id, role)
    // If we want multiple roles, we should check if 'investor' role exists first.
    
    const { data: existingRole, error: existingRoleError } = await adminSupabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'investor')
      .eq('business_id', businessId)
      .maybeSingle()
    if (existingRoleError) {
      console.error('Failed to check investor role:', existingRoleError)
      if (!existingProfile) await adminSupabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Failed to assign investor role' }, { status: 500 })
    }

    if (!existingRole) {
      const { error: roleError } = await adminSupabase
        .from('user_roles')
        .insert({
          user_id: userId,
          business_id: businessId,
          role: 'investor'
        })

      if (roleError) {
        // Only rollback user if we just created it
        if (!existingProfile) {
          await adminSupabase.auth.admin.deleteUser(userId)
        }
        console.error(roleError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
      }
    }

    // Generate investor_id
    const { data: lastInvestor, error: lastInvestorError } = await adminSupabase
      .from('investors')
      .select('investor_id')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastInvestorError) {
      console.error('Failed to generate investor id:', lastInvestorError)
      return NextResponse.json({ error: 'Failed to create investor id' }, { status: 500 })
    }
    
    let nextIdNumber = 1
    if (lastInvestor?.investor_id) {
      const match = lastInvestor.investor_id.match(/INV(\d+)/)
      if (match) {
        nextIdNumber = parseInt(match[1]) + 1
      }
    }
    const tenantSuffix = businessId.replace(/-/g, '').toUpperCase()
    const investor_id = `INV${nextIdNumber.toString().padStart(4, '0')}-${tenantSuffix}`

    // Create investor record
    const { data: investor, error: investorError } = await adminSupabase
      .from('investors')
      .insert({
        business_id: businessId,
        user_id: userId,
        investor_id,
        full_name: resolvedFullName,
        email: normalizedEmail,
        phone: normalizedPhone || null,
        investment_amount: principalAmount,
        daily_return_rate: returnRate,
        tenure_months: tenureMonths,
        investment_date: startDateString,
        expected_maturity_date: expectedMaturityDate.toISOString().slice(0, 10),
        // notes, // Removed: Not in schema
        status: 'active',
        total_returns_earned: 0,
        total_returns_paid: 0,
        current_balance: 0
      })
      .select()
      .single()

    if (investorError) {
      // Don't delete user if it was an existing profile
      if (!existingProfile) {
        await adminSupabase.auth.admin.deleteUser(userId)
      }
      console.error(investorError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({
      investor: {
        ...investor,
        name: investor.full_name,
        principal_amount: investor.investment_amount,
        return_rate: investor.daily_return_rate,
        start_date: investor.investment_date
      },
      message: 'Investor created successfully. Login credentials sent via email.'
    })
  } catch (error) {
    console.error('Investor creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
