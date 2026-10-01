const nigeriaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function getNigeriaDate(date: Date): string {
  return nigeriaDateFormatter.format(date)
}

export function getPreviousNigeriaDayWindow(now: Date): {
  date: string
  start: Date
  end: Date
} {
  const todayStart = new Date(`${getNigeriaDate(now)}T00:00:00+01:00`)
  const start = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
  return {
    date: getNigeriaDate(start),
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1),
  }
}
