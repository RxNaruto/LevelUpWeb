export interface TimeOfDay {
  hour: number
  minute: number
}

export function parseTime(time: string): TimeOfDay {
  const [rawHour, rawMinute] = time.split(':')
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  const valid = Number.isInteger(hour) && Number.isInteger(minute)
  return valid && hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? { hour, minute } : { hour: 21, minute: 0 }
}

/**
 * Every slot from the start time to the last full hour before the day resets.
 * A 9pm start with hourly repeats gives 9pm, 10pm and 11pm.
 */
export function reminderSlots(startTime: string, hourly: boolean): TimeOfDay[] {
  const start = parseTime(startTime)
  if (!hourly) return [start]
  const slots: TimeOfDay[] = []
  for (let hour = start.hour; hour < 24; hour += 1) slots.push({ hour, minute: start.minute })
  return slots
}

/** "2h 30m", "45m". */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function minutesUntilReset({ hour, minute }: TimeOfDay): number {
  return 24 * 60 - (hour * 60 + minute)
}
