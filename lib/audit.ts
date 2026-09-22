import { createAdminClient } from '@/lib/utils/supabase'
export async function logAudit(params: { 
  action_type: string 
  entity_type: string 
  entity_id?: string 
  performed_by?: string 
  performed_by_role?: string 
  before_data?: any 
  after_data?: any 
  metadata?: any 
  notes?: string 
}) { 
  try { 
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({ 
      ...params, 
      entity_id: params.entity_id || null, 
      performed_by: params.performed_by || null, 
    }) 
  } catch (e) { 
    console.error('Audit log failed silently:', e) 
  } 
}