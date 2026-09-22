import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/utils/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    return NextResponse.json({ message: 'Logged out successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}