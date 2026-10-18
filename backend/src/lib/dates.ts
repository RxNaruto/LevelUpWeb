/**
 * Every entry is keyed by the user's local calendar day, so "today" is always
 * computed in the user's IANA timezone rather than the server's.
 */

const dayFormatters = new Map<string, Intl.DateTimeFormat>()
const timeFormatters = new Map<string, Intl.DateTimeFormat>()

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dayFormatters.set(timeZone, formatter)
  }
  return formatter
}

function timeFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timeFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    timeFormatters.set(timeZone, formatter)
  }
  return formatter
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** Local calendar day as YYYY-MM-DD. */
export function today(timeZone: string, at: Date = new Date()): string {
  return dayFormatter(timeZone).format(at)
}

/** Local wall-clock time as { hour, minute }, 24-hour. */
export function localTime(timeZone: string, at: Date = new Date()): { hour: number; minute: number } {
  const parts = timeFormatter(timeZone).formatToParts(at)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return { hour: hour % 24, minute }
}

/** ISO weekday, 1 = Monday through 7 = Sunday. Anchored at midday UTC. */
export function isoWeekday(day: string): number {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

export function shiftDay(day: string, deltaDays: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + deltaDays)
  return date.toISOString().slice(0, 10)
}

export function weekStart(day: string): string {
  return shiftDay(day, 1 - isoWeekday(day))
}

/** Stable ISO-week period key used by weekly task entries and XP caps. */
export function weekKey(day: string): string {
  return `week:${weekStart(day)}`
}

/** Most recent `count` days, oldest first, ending at `from`. */
export function recentDays(count: number, from: string): string[] {
  return Array.from({ length: count }, (_, index) => shiftDay(from, index - count + 1))
}

/** A `@db.Date` column as YYYY-MM-DD. */
export function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

/** YYYY-MM-DD to the midnight-UTC Date Prisma expects for a `@db.Date` column. */
export function toDateColumn(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00Z`) : null
}
