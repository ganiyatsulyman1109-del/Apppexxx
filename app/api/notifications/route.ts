import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/utils/supabase'
import { notifyRole, notifyUsers } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()
    
    if (roleError || !roleData?.role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const is_read = searchParams.get('is_read')
    const limit = searchParams.get('limit') || '50'
    
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (type) {
      query = query.eq('type', type)
    }
    
    if (category) {
      query = query.eq('category', category)
    }
    
    if (is_read !== null) {
      query = query.eq('is_read', is_read === 'true')
    }

    if (roleData.role !== 'admin') {
      query = query.eq('user_id', session.user.id)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }

    let unreadCount = 0
    const unreadQuery = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
    
    if (roleData.role !== 'admin') {
      unreadQuery.eq('user_id', session.user.id)
    }

    const { count } = await unreadQuery
    unreadCount = count || 0
    
    return NextResponse.json({ notifications: data || [], unreadCount })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()

    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()
    
    if (roleError || roleData?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const body = await request.json()
    const { title, message, type, category, action_url, action_text, expires_at, user_ids, role } = body
    
    if (!title || !message || !type || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const payload = {
      title,
      message,
      type,
      category,
      action_url: action_url || null,
      action_text: action_text || null,
      expires_at: expires_at || null
    }

    if (Array.isArray(user_ids) && user_ids.length > 0) {
      const result = await notifyUsers(user_ids, payload)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    if (role) {
      const result = await notifyRole(role, payload)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'user_ids or role is required' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, all } = body

    if (all) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false)
      
      if (error) {
        console.error(error);
        return NextResponse.json(
          { error: 'An internal error occurred. Please try again.' },
          { status: 500 }
        )
      }
    } else if (id) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', session.user.id)

      if (error) {
        console.error(error);
        return NextResponse.json(
          { error: 'An internal error occurred. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
