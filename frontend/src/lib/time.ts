export interface TimeOfDay {
  hour: number
  minute: number
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

export function parseTime(time: string): TimeOfDay {
  const [rawHour, rawMinute] = time.split(':')
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  const valid = Number.isInteger(hour) && Number.isInteger(minute)
  return valid && hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? { hour, minute } : { hour: 21, minute: 0 }
}

export function formatTime({ hour, minute }: TimeOfDay): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${pad2(minute)} ${suffix}`
}

/** Every slot from the start time to the last full hour before the day resets. */
export function reminderSlots(startTime: string, hourly: boolean): TimeOfDay[] {
  const start = parseTime(startTime)
  if (!hourly) return [start]
  const slots: TimeOfDay[] = []
  for (let hour = start.hour; hour < 24; hour += 1) slots.push({ hour, minute: start.minute })
  return slots
}

export function clockFace(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}
