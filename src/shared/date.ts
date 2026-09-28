/** Local calendar day, e.g. "2026-09-02". Local, not UTC — "today" means the user's today. */
export function todayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
