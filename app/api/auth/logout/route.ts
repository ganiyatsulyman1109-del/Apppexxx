import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/utils/supabase'

export async function POST() {
  try {
    const supabase = createServerClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
    }


    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}