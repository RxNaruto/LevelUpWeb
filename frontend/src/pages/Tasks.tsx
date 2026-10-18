import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { describeError } from '@/api/client'
import { tasksApi } from '@/api/endpoints'
import { invalidateProgress, keys, queryClient } from '@/api/queryClient'
import type { Task } from '@/api/types'
import { useFeedback } from '@/components/useFeedback'
import { Button, Card, Chip, EmptyState, ErrorState, LoadingState, PageHeader, Screen } from '@/components/ui'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function scheduleLabel(task: Task): string {
  if (task.cadence === 'WEEKLY') return 'Once a week'
  if (task.activeDays.length === 0) return 'Every day'
  return task.activeDays.map((day) => DAY_LABELS[day - 1]).join(', ')
}

export default function Tasks() {
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const tasks = useQuery({ queryKey: keys.tasks, queryFn: tasksApi.list })
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (taskId: string, action: () => Promise<unknown>) => {
    setBusy(taskId)
    try {
      await action()
      await Promise.all([queryClient.invalidateQueries({ queryKey: keys.tasks }), invalidateProgress()])
    } catch (error) {
      toast(describeError(error), { title: 'Could not save', tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const confirmArchive = async (task: Task) => {
    const ok = await confirm({
      title: 'Archive task?',
      message: `"${task.title}" stops appearing on Today. Past history is kept.`,
      confirmLabel: 'Archive',
      destructive: true,
    })
    if (ok) await run(task.id, () => tasksApi.archive(task.id))
  }

  if (tasks.isPending) {
    return (
      <Screen>
        <LoadingState message="Loading tasks…" fullScreen />
      </Screen>
    )
  }

  if (tasks.isError) {
    return (
      <Screen>
        <ErrorState message={describeError(tasks.error)} onRetry={() => void tasks.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <PageHeader title="Tasks" subtitle="Templates that generate your daily and weekly checklist." />

      <Button title="New task" fullWidth className="mb-lg" onClick={() => navigate('/tasks/new')} />

      {tasks.data.length === 0 ? (
        <EmptyState title="No tasks yet" message="Create your first recurring task and it will appear on Today." icon="▣" />
      ) : (
        <div className="stack gap-md">
          {tasks.data.map((task) => (
            <Card key={task.id} className="gap-md">
              <div className="row start between gap-md">
                <h2 className="t-subheading grow clamp-2">{task.title}</h2>
                <span className="t-caption t-primary">{task.target} {task.unit}</span>
              </div>

              {task.description ? <p className="t-body-muted clamp-2">{task.description}</p> : null}

              <div className="row wrap gap-xs">
                <Chip label={scheduleLabel(task)} />
                <Chip label={task.priority.toLowerCase()} />
                {task.projectName ? <Chip label={task.projectName} variant="accent" /> : null}
                {task.paused ? <Chip label="paused" variant="warning" /> : null}
              </div>

              <div className="row gap-sm">
                <Button title="Edit" variant="secondary" size="sm" disabled={busy === task.id} onClick={() => navigate(`/tasks/${task.id}`)} />
                <Button
                  title={task.paused ? 'Resume' : 'Pause'}
                  variant="ghost"
                  size="sm"
                  disabled={busy === task.id}
                  onClick={() => void run(task.id, () => tasksApi.setPaused(task.id, !task.paused))}
                />
                <Button title="Archive" variant="ghost" size="sm" disabled={busy === task.id} onClick={() => void confirmArchive(task)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  )
}
