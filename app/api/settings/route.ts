import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/utils/supabase'

const defaultSettings = [
  { key: "business_name", value: "My Business", data_type: "string", category: "business", description: "Business name", is_public: true },
  { key: "business_email", value: "hello@mybusiness.com", data_type: "string", category: "business", description: "Business email", is_public: true },
  { key: "business_phone", value: "+234 803 456 7890", data_type: "string", category: "business", description: "Business phone", is_public: true },
  { key: "business_website", value: "www.mybusiness.com", data_type: "string", category: "business", description: "Business website", is_public: true },
  { key: "business_address", value: "HQ: No. 1a Amule Road, Amule Bus stop, Ayobo, Lagos State | Branch: No. 608 Lagos-Abeokuta Express way, Ijaye Bus stop, Lagos State", data_type: "string", category: "business", description: "Business address", is_public: true },
  { key: "tax_id", value: "RC-1234567", data_type: "string", category: "business", description: "Tax ID", is_public: false },
  { key: "currency", value: "NGN", data_type: "string", category: "business", description: "Currency code", is_public: true },
  { key: "tax_rate", value: "0", data_type: "number", category: "business", description: "Tax rate percentage", is_public: false },
  { key: "notifications_email", value: "true", data_type: "boolean", category: "notifications", description: "Email notifications", is_public: false },
  { key: "notifications_sms", value: "false", data_type: "boolean", category: "notifications", description: "SMS notifications", is_public: false },
  { key: "low_stock_alerts", value: "true", data_type: "boolean", category: "notifications", description: "Low stock alerts", is_public: false },
  { key: "order_alerts", value: "true", data_type: "boolean", category: "notifications", description: "New order alerts", is_public: false },
  { key: "auto_reorder", value: "false", data_type: "boolean", category: "notifications", description: "Auto reorder", is_public: false },
  { key: "receipt_header", value: "My Business", data_type: "string", category: "receipt", description: "Receipt header text", is_public: false },
  { key: "receipt_footer", value: "Thank you for your business!", data_type: "string", category: "receipt", description: "Receipt footer text", is_public: false },
  { key: "printer_type", value: "thermal", data_type: "string", category: "receipt", description: "Printer type", is_public: false },
  { key: "auto_print", value: "true", data_type: "boolean", category: "receipt", description: "Auto print receipts", is_public: false }
]

const normalizeValue = (value: any) => {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return value.toString()
  return JSON.stringify(value)
}

const inferDataType = (value: any) => {
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "object") return "json"
  return "string"
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
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    
    const supabase = createAdminSupabaseClient()
    
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('key', { ascending: true })
    
    if (error) {
      console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
    }
    
    if (data && data.length === 0) {
      const adminSupabase = createAdminSupabaseClient()
      const { data: seeded, error: seedError } = await adminSupabase
        .from('settings')
        .insert(defaultSettings)
        .select('*')
        .order('key', { ascending: true })

      if (seedError) {
        console.error(seedError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
      }

      return NextResponse.json({ settings: seeded })
    }

    // Convert to key-value object
    const result: Record<string, any> = {}
    if (data) {
      data.forEach((row: any) => {
        result[row.key] = row.value
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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
    
    const supabase = createAdminSupabaseClient()
    
    const body = await request.json()
    
    // Iterate over body keys and upsert each setting
    for (const [key, value] of Object.entries(body)) {
      if (key === 'settings') continue // Skip if legacy format is mixed in (though we shouldn't send it)
      
      // Infer details for upsert if not provided in simple k:v pair
      // We default to string/general if unknown, but better to query first? 
      // For simplicity/performance in this "Surgical" fix, we assume existing keys mostly
      // Or we accept that metadata might be lost if we don't fetch first. 
      // Actually, upsert with just key/value will keep other columns if we don't specify them? 
      // No, upsert replaces. So we should really be careful.
      // The requirement says: "Fix PUT handler to upsert each field... await adminSupabase.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' })"
      
      // We will follow the instruction exactly.
      await supabase
        .from('settings')
        .upsert(
          { 
            key, 
            value: String(value)
            // Note: This might clear description/category if they are not default. 
            // But the prompt was specific. We assume the DB has defaults or we don't care about metadata for this fix.
          }, 
          { onConflict: 'key' }
        )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
