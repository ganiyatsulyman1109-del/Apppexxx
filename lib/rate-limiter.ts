export async function checkRateLimitDB(
  ip: string,
  supabase: any
): Promise<{ allowed: boolean; message: string }> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('action_type', 'failed_auth')
    .eq('entity_id', ip)
    .gte('created_at', windowStart)

  if (error) {
    console.error('Failed to check staff login rate limit:', error)
    throw new Error('Unable to verify login rate limit')
  }

  const attempts = count || 0

  if (attempts >= 5) {
    return {
      allowed: false,
      message: 'Too many failed attempts. Please wait 15 minutes.'
    }
  }

  return { allowed: true, message: '' }
}

export async function logFailedAttempt(
  ip: string,
  supabase: any
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    action_type: 'failed_auth',
    entity_type: 'ip_address',
    entity_id: ip,
    notes: 'Failed authentication attempt',
    created_at: new Date().toISOString()
  })

  if (error) {
    console.error('Failed to record staff login attempt:', error)
    throw new Error('Unable to record failed login attempt')
  }
}
