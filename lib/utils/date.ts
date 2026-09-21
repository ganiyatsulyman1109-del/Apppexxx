
export function toNigeriaDateTime(utcTimestamp: string | Date | number): string { 
  const date = new Date(utcTimestamp) 
  return date.toLocaleString('en-NG', { 
    timeZone: 'Africa/Lagos', 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  }) 
}

export function formatDate(
  date: string | Date | null | undefined
): string {
  if (!date) return '—'
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Africa/Lagos'
    }).format(new Date(date))
  } catch {
    return '—'
  }
}

export function formatDateTime(
  date: string | Date | null | undefined
): string {
  if (!date) return '-'
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos'
    }).format(new Date(date))
  } catch {
    return '-'
  }
}

export function formatNigerianDate(
  utcTimestamp: string | Date | number,
  format: 'full' | 'date' | 'time' | 'datetime' = 'datetime'
): string {
  if (!utcTimestamp) return ''
  const date = new Date(utcTimestamp)
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Lagos',
    ...(format === 'full' || format === 'datetime' ? {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    } : format === 'date' ? {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    } : {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }
  
  const formatted = new Intl.DateTimeFormat('en-NG', options).format(date)
  
  // Format as dd/mm/yyyy hh:mm:ss for readability
  if (format === 'date') {
    const parts = new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date)
    const day = parts.find(p => p.type === 'day')?.value || ''
    const month = parts.find(p => p.type === 'month')?.value || ''
    const year = parts.find(p => p.type === 'year')?.value || ''
    return `${day}/${month}/${year}`
  } else if (format === 'datetime' || format === 'full') {
    const parts = new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).formatToParts(date)
    const day = parts.find(p => p.type === 'day')?.value || ''
    const month = parts.find(p => p.type === 'month')?.value || ''
    const year = parts.find(p => p.type === 'year')?.value || ''
    const hour = parts.find(p => p.type === 'hour')?.value || ''
    const minute = parts.find(p => p.type === 'minute')?.value || ''
    const period = parts.find(p => p.type === 'dayPeriod')?.value || ''
    return `${day}/${month}/${year} ${hour}:${minute} ${period}`
  }
  
  return formatted
}

export function getNigerianDateRange(period: 'today' | 'week' | 'month') {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    return getNigerianDayBounds()
  }

  const todayStr = `${year}-${month}-${day}`
  const toNigerianIso = (dateStr: string, isEnd = false) =>
    new Date(`${dateStr}T${isEnd ? '23:59:59.999' : '00:00:00.000'}+01:00`).toISOString()

  if (period === 'today') {
    return {
      start: toNigerianIso(todayStr),
      end: toNigerianIso(todayStr, true)
    }
  }

  if (period === 'week') {
    const start = new Date(toNigerianIso(todayStr))
    start.setUTCDate(start.getUTCDate() - 6)
    return {
      start: start.toISOString(),
      end: toNigerianIso(todayStr, true)
    }
  }

  const monthStart = `${year}-${month}-01`
  return {
    start: toNigerianIso(monthStart),
    end: toNigerianIso(todayStr, true)
  }
}

export function getNigerianDayBounds(): { 
  start: string 
  end: string 
} { 
  const now = new Date() 
  // Nigeria is UTC+1 
  const nigeriaOffset = 60 * 60 * 1000 
  const nigeriaNow = new Date(now.getTime() + nigeriaOffset) 
  
  const startOfDay = new Date(nigeriaNow) 
  startOfDay.setUTCHours(0, 0, 0, 0) 
  
  const endOfDay = new Date(nigeriaNow) 
  endOfDay.setUTCHours(23, 59, 59, 999) 
  
  // Convert back to UTC for DB queries 
  const startUTC = new Date( 
    startOfDay.getTime() - nigeriaOffset 
  ) 
  const endUTC = new Date( 
    endOfDay.getTime() - nigeriaOffset 
  ) 
  
  return { 
    start: startUTC.toISOString(), 
    end: endUTC.toISOString() 
  } 
}
