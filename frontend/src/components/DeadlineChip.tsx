import { daysUntil, prettyDay } from '@/lib/dates'
import { Chip } from './ui'

export function DeadlineChip({ deadline }: { deadline: string | null }) {
  if (!deadline) return null
  const days = daysUntil(deadline)
  if (days < 0) return <Chip label={`${Math.abs(days)}d overdue`} variant="warning" />
  if (days <= 7) return <Chip label={`${days}d left`} variant="warning" />
  return <Chip label={prettyDay(deadline)} />
}
