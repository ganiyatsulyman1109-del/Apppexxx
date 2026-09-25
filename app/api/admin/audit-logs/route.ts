import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuthResult as requireAdminAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/utils/supabase'

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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const action_type = searchParams.get('action_type')
    const entity_type = searchParams.get('entity_type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const offset = (page - 1) * limit

    const supabase = createAdminClient()

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (action_type && action_type !== 'all') {
      query = query.eq('action_type', action_type)
    }

    if (entity_type && entity_type !== 'all') {
      query = query.eq('entity_type', entity_type)
    }
    
    if (startDate) {
      query = query.gte('created_at', new Date(startDate + 'T00:00:00+01:00').toISOString())
    }
    
    if (endDate) {
      query = query.lte('created_at', new Date(endDate + 'T23:59:59+01:00').toISOString())
    }
    
    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    return NextResponse.json({ 
      logs: data, 
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}