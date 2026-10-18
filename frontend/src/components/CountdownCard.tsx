import { useNow } from '@/hooks/useNow'
import { clockFace } from '@/lib/time'
import { ProgressBar } from './ui'

interface CountdownCardProps {
  /** Midnight — when today's entries stop accepting progress. */
  deadline: Date
  /** Before this the card stays hidden. */
  startAt: Date
  remainingTasks: number
}

export function CountdownCard({ deadline, startAt, remainingTasks }: CountdownCardProps) {
  // A once-a-second timer has no business running the hours the card is
  // hidden, so a slow clock decides whether the fast one runs.
  const coarse = useNow(30_000)
  const inWindow = coarse >= startAt.getTime() && coarse < deadline.getTime()
  const precise = useNow(1000, inWindow)
  const now = Math.max(coarse, precise)

  const remaining = deadline.getTime() - now
  const span = deadline.getTime() - startAt.getTime()

  if (!inWindow || remaining <= 0 || span <= 0) return null

  const urgent = remaining <= 30 * 60 * 1000

  return (
    <div className={`countdown ${urgent ? 'countdown--urgent' : ''}`} role="timer" aria-live="off">
      <div className="row between">
        <span className="t-label" style={{ color: 'var(--tint)' }}>Time left today</span>
        <span className="t-caption">{remainingTasks === 0 ? 'All clear' : `${remainingTasks} still open`}</span>
      </div>
      <span className="countdown__clock t-timer">{clockFace(remaining)}</span>
      <ProgressBar value={1 - remaining / span} tint="var(--tint)" height={6} />
    </div>
  )
}
