import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { describeError } from '@/api/client'
import { connectionsApi, settingsApi, tasksApi } from '@/api/endpoints'
import { invalidateProgress, keys, queryClient } from '@/api/queryClient'
import type { ProgressResult, TodayResult } from '@/api/types'
import { useAuth } from '@/auth/useAuth'
import { CountdownCard } from '@/components/CountdownCard'
import { useFeedback } from '@/components/useFeedback'
import { TaskRow } from '@/components/TaskRow'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Screen, Stat } from '@/components/ui'
import { nextReset, prettyDay } from '@/lib/dates'

/** The server also syncs on a schedule; this catches up once per visit so opening the app is current. */
let syncedThisSession = false

export default function Today() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useFeedback()
  const today = useQuery({ queryKey: keys.today, queryFn: tasksApi.today })
  const settings = useQuery({ queryKey: keys.settings, queryFn: settingsApi.get })

  const [busyTask, setBusyTask] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const day = today.data?.day
  const leadHours = settings.data?.countdownLeadHours ?? 2

  const countdownWindow = useMemo(() => {
    const deadline = nextReset()
    return { deadline, startAt: new Date(deadline.getTime() - leadHours * 60 * 60 * 1000) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, leadHours])

  const showFlash = useCallback((message: string) => {
    setFlash(message)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 2400)
  }, [])

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current)
  }, [])

  useEffect(() => {
    if (syncedThisSession) return
    syncedThisSession = true
    void connectionsApi
      .sync()
      .then((outcomes) => {
        void queryClient.invalidateQueries({ queryKey: keys.connections })
        if (outcomes.some((outcome) => outcome.status === 'updated')) {
          showFlash('Updated from your connected apps')
          void invalidateProgress()
        }
      })
      .catch(() => undefined)
  }, [showFlash])

  /**
   * Paints the new value immediately, then reconciles with what the server
   * stored, so checking a box never waits on a round trip.
   */
  const mutate = useCallback(
    async (taskId: string, optimistic: (progress: number, target: number) => number, run: () => Promise<ProgressResult>) => {
      await queryClient.cancelQueries({ queryKey: keys.today })
      setBusyTask(taskId)
      queryClient.setQueryData<TodayResult>(keys.today, (current) =>
        current && {
          ...current,
          tasks: current.tasks.map((task) => {
            if (task.id !== taskId) return task
            const next = optimistic(task.entry.progress, task.target)
            return { ...task, entry: { ...task.entry, progress: next, completed: next >= task.target } }
          }),
        },
      )

      try {
        const result = await run()
        if (result.xpAwarded > 0) showFlash(`+${result.xpAwarded} XP`)
      } catch (error) {
        toast(describeError(error), { title: 'Could not save', tone: 'error' })
      } finally {
        setBusyTask(null)
        await invalidateProgress()
      }
    },
    [showFlash, toast],
  )

  if (today.isPending) {
    return (
      <Screen>
        <LoadingState message="Loading today…" fullScreen />
      </Screen>
    )
  }

  if (today.isError) {
    return (
      <Screen>
        <ErrorState message={describeError(today.error)} onRetry={() => void today.refetch()} />
      </Screen>
    )
  }

  const { tasks, streak, xp } = today.data
  const done = tasks.filter((task) => task.entry.completed).length
  const allDone = tasks.length > 0 && done === tasks.length
  const displayName = settings.data?.displayName ?? user?.name ?? 'there'

  return (
    <Screen>
      <PageHeader eyebrow="LEVEL UP" title={`Hey ${displayName}`} subtitle={prettyDay(today.data.day)} />

      <div className="stats mb-lg">
        <Stat label="Level" value={xp.level} hint={`${xp.xpTotal} XP total`} />
        <Stat
          label="Streak"
          value={streak}
          hint={streak === 1 ? 'day' : 'days'}
          tint={streak > 0 ? 'var(--warning)' : 'var(--text-faint)'}
        />
        <Stat
          label="Today"
          value={`${done}/${tasks.length}`}
          hint={`+${xp.todayXp} XP`}
          tint={allDone ? 'var(--success)' : 'var(--primary-hover)'}
        />
      </div>

      <div className="level-bar">
        <div className="row between">
          <span className="t-label">Level {xp.level}</span>
          <span className="t-caption">{xp.xpInLevel} / {xp.xpToNext} XP</span>
        </div>
        <ProgressBar value={xp.xpToNext ? xp.xpInLevel / xp.xpToNext : 0} height={8} />
      </div>

      {settings.data?.countdownEnabled !== false && !allDone ? (
        <CountdownCard
          deadline={countdownWindow.deadline}
          startAt={countdownWindow.startAt}
          remainingTasks={tasks.length - done}
        />
      ) : null}

      {flash ? <p className="flash" role="status">{flash}</p> : null}

      {allDone ? (
        <p className="t-caption t-success" style={{ marginBottom: 'var(--md)' }}>
          Everything done for today. Streak is safe.
        </p>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing scheduled today"
          message="Add a recurring task from the Tasks tab and it will show up here on its active days."
          icon="◎"
        />
      ) : (
        <div className="stack gap-sm">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              disabled={busyTask === task.id}
              onToggle={() =>
                void mutate(
                  task.id,
                  (progress, target) => (progress >= target ? 0 : target),
                  () => tasksApi.toggle(task.id),
                )
              }
              onStep={(delta) => {
                const next = Math.max(0, Math.min(task.target, task.entry.progress + delta))
                void mutate(task.id, () => next, () => tasksApi.setProgress(task.id, next))
              }}
            />
          ))}
        </div>
      )}

      <Button title="+ Add a task" variant="ghost" fullWidth className="mt-xl" onClick={() => navigate('/tasks/new')} />
    </Screen>
  )
}
