/**
 * The time zone "today" is counted in. Unset means the machine's own, which is
 * right on the desktop and in the browser. The cloud runs on UTC, so it is set
 * there, per request, from the zone the client reports.
 */
let timeZone: string | undefined

/** Ignores anything that isn't a zone Intl knows, so a bad header can't break dates. */
export function setTimeZone(zone: string | null | undefined): void {
  if (!zone) return
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone })
    timeZone = zone
  } catch {
    // Unknown zone: keep the previous one.
  }
}

/** Local calendar day, e.g. "2026-09-02". Local, not UTC — "today" means the user's today. */
export function todayKey(date: Date = new Date()): string {
  if (timeZone) {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date)
  }
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
