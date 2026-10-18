function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** Local calendar day as YYYY-MM-DD. */
export function today(at: Date = new Date()): string {
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`
}

export function isoWeekday(day: string): number {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function weekdayLabel(day: string): string {
  return WEEKDAY_LABELS[isoWeekday(day) - 1] ?? ''
}

/** e.g. "Fri 4 Sep". */
export function prettyDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return day
  return `${weekdayLabel(day)} ${date} ${MONTH_LABELS[month - 1]}`
}

/** Whole days from now until `day` (negative once it has passed). */
export function daysUntil(day: string): number {
  return Math.round((new Date(`${day}T12:00:00Z`).getTime() - Date.now()) / 86_400_000)
}

export function isToday(day: string): boolean {
  return day === today()
}

/** Midnight at the end of the day we are currently in. */
export function nextReset(from: Date = new Date()): Date {
  const reset = new Date(from)
  reset.setHours(24, 0, 0, 0)
  return reset
}

export function relativeTime(value: string): string {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (!Number.isFinite(minutes)) return 'connected'
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  return `${Math.round(minutes / 1440)}d ago`
}
