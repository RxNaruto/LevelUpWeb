import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { describeError } from '@/api/client'
import { projectsApi, tasksApi } from '@/api/endpoints'
import { invalidateProgress, keys, queryClient } from '@/api/queryClient'
import { EMPTY_TASK, type TaskInput } from '@/api/types'
import { TaskForm } from '@/components/TaskForm'
import { useFeedback } from '@/components/useFeedback'
import { ErrorState, LoadingState, PageHeader, Screen } from '@/components/ui'

/** Create when there's no `:id` in the route, edit otherwise. */
export default function TaskEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useFeedback()
  const [saving, setSaving] = useState(false)

  const projects = useQuery({ queryKey: keys.projects, queryFn: projectsApi.list })
  const task = useQuery({ queryKey: keys.task(id ?? ''), queryFn: () => tasksApi.get(id!), enabled: Boolean(id) })

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/tasks'))

  const submit = async (input: TaskInput) => {
    setSaving(true)
    try {
      if (id) await tasksApi.update(id, input)
      else await tasksApi.create(input)
      await Promise.all([queryClient.invalidateQueries({ queryKey: keys.tasks }), queryClient.invalidateQueries({ queryKey: keys.projects }), invalidateProgress()])
      back()
    } catch (error) {
      toast(describeError(error), { title: id ? 'Could not save task' : 'Could not create task', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (projects.isPending || (id && task.isPending)) {
    return (
      <Screen bare>
        <LoadingState message="Loading…" fullScreen />
      </Screen>
    )
  }

  if (id && task.isError) {
    return (
      <Screen bare>
        <PageHeader title="Edit task" onBack={back} />
        <ErrorState message={describeError(task.error)} onRetry={() => void task.refetch()} />
      </Screen>
    )
  }

  const initial: TaskInput = task.data
    ? {
        title: task.data.title,
        description: task.data.description,
        category: task.data.category,
        provider: task.data.provider,
        target: task.data.target,
        unit: task.data.unit,
        activeDays: task.data.activeDays,
        priority: task.data.priority,
        cadence: task.data.cadence,
        projectId: task.data.projectId,
      }
    : EMPTY_TASK

  return (
    <Screen bare>
      <PageHeader
        title={id ? 'Edit task' : 'New task'}
        subtitle={id ? 'Update the template. Your history stays as it was.' : 'It shows up on Today from its next active day.'}
        onBack={back}
      />
      <TaskForm
        key={task.data?.id ?? 'new'}
        initial={initial}
        projects={projects.data ?? []}
        submitLabel={id ? 'Save changes' : 'Create task'}
        saving={saving}
        onSubmit={(input) => void submit(input)}
      />
    </Screen>
  )
}
