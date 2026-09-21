import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    
    // Check for error in auth result (requireAuth returns { error, status } or { user, supabase })
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    const { user, supabase } = authResult

    // Only allow users to access their own profile or admin/staff to access any profile
    if (user.role !== 'admin' && user.role !== 'staff' && user.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get customer profile with orders
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`*, customers(*)`)
      .eq('id', id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Customer profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
