import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerClient } from '@/lib/utils/supabase'
import { requireAdminAuth } from '@/lib/auth'

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

    const authResult = await requireAdminAuth(request)
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: authResult.status || 401 })
    }

    const adminSupabase = createAdminClient()
    const { id } = await params

    const body = await request.json().catch(() => ({}))
    let { status } = body as { status?: string }

    if (!status) {
      const { data: existingInvestor } = await adminSupabase
        .from('investors')
        .select('status')
        .eq('id', id)
        .single()

      status = existingInvestor?.status === 'active' ? 'inactive' : 'active'
    }

    if (!['active', 'inactive'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }

    const { data, error } = await adminSupabase
      .from('investors')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, user_id')
      .single()
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    if (data.user_id) {
      const { error: banError } = await adminSupabase.auth.admin.updateUserById(
        data.user_id,
        { ban_duration: status === 'inactive' ? '876000h' : 'none' }
      )
      if (banError) {
        console.error('Error updating ban status:', banError)
      }
    }

    return NextResponse.json({
      investor: {
        ...data,
        name: data.full_name
      },
      message: 'Investor status updated successfully'
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
