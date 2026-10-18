import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { describeError } from '@/api/client'
import { tasksApi } from '@/api/endpoints'
import { keys } from '@/api/queryClient'
import { EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Screen, Segmented, Stat } from '@/components/ui'
import { isToday, prettyDay } from '@/lib/dates'

const RANGES = ['7', '30', '90'] as const
type Range = (typeof RANGES)[number]

export default function History() {
  const [range, setRange] = useState<Range>('7')
  const days = Number(range)
  const history = useQuery({
    queryKey: keys.history(days),
    queryFn: () => tasksApi.history(days),
    placeholderData: keepPreviousData,
  })

  if (history.isPending) {
    return (
      <Screen>
        <LoadingState message="Loading history…" fullScreen />
      </Screen>
    )
  }

  if (history.isError) {
    return (
      <Screen>
        <ErrorState message={describeError(history.error)} onRetry={() => void history.refetch()} />
      </Screen>
    )
  }

  const rows = history.data.days
  const tracked = rows.filter((row) => row.total > 0)
  const perfect = tracked.filter((row) => row.completed === row.total).length
  const average = tracked.length ? Math.round(tracked.reduce((sum, row) => sum + row.percent, 0) / tracked.length) : 0
  const ordered = [...rows].reverse()

  return (
    <Screen>
      <PageHeader title="History" subtitle="How much of each day you completed." />

      <Segmented label="Range" options={RANGES} value={range} onChange={setRange} format={(option) => `${option} days`} />

      <div className="stats mt-lg mb-lg" style={{ opacity: history.isPlaceholderData ? 0.6 : 1 }}>
        <Stat label="Streak" value={history.data.streak} hint="days" />
        <Stat label="Perfect" value={perfect} hint={`of ${tracked.length} tracked`} />
        <Stat label="Average" value={`${average}%`} />
      </div>

      {tracked.length === 0 ? (
        <EmptyState title="No history yet" message="Complete a few days of tasks and they will show up here." icon="▤" />
      ) : (
        <div className="stack gap-md">
          {ordered.map((row) => {
            const empty = row.total === 0
            const full = !empty && row.completed === row.total
            return (
              <div key={row.day} className="history-row">
                <span className={`history-row__day ${isToday(row.day) ? 'history-row__day--today' : ''}`}>{prettyDay(row.day)}</span>
                <div className="grow">
                  <ProgressBar value={empty ? 0 : row.completed / row.total} tint={full ? 'var(--success)' : 'var(--primary)'} />
                </div>
                <span className="history-row__count">{empty ? '—' : `${row.completed}/${row.total}`}</span>
              </div>
            )
          })}
        </div>
      )}
    </Screen>
  )
}
