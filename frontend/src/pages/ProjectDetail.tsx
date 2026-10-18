import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { describeError } from '@/api/client'
import { projectsApi } from '@/api/endpoints'
import { invalidateProgress, keys, queryClient } from '@/api/queryClient'
import type { ProjectDetail as Detail, ProjectStatus } from '@/api/types'
import { useFeedback } from '@/components/useFeedback'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  ProgressBar,
  Screen,
  Segmented,
  Stat,
  Stepper,
  TextArea,
} from '@/components/ui'
import { DeadlineChip } from '@/components/DeadlineChip'
import { daysUntil, prettyDay } from '@/lib/dates'
import { formatMinutes } from '@/lib/time'

const WEIGHTS = ['1', '2', '3', '4'] as const

function DetailsCard({ project, onSaved }: { project: Detail; onSaved: () => Promise<void> }) {
  const { toast } = useFeedback()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [deadline, setDeadline] = useState(project.deadline ?? '')
  const savedHours = project.estimatedMinutes ? Math.round(project.estimatedMinutes / 60) : 0
  const [estimateHours, setEstimateHours] = useState(savedHours)
  const [saving, setSaving] = useState(false)

  const dirty =
    name.trim() !== project.name ||
    description.trim() !== project.description ||
    (deadline || null) !== project.deadline ||
    estimateHours !== savedHours

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await projectsApi.update(project.id, {
        name: name.trim(),
        description: description.trim(),
        deadline: deadline || null,
        estimatedMinutes: estimateHours ? estimateHours * 60 : null,
      })
      await onSaved()
    } catch (error) {
      toast(describeError(error), { title: 'Could not save project', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="gap-lg mb-lg">
      <form className="stack gap-lg" onSubmit={(event) => void save(event)}>
        <span className="t-label">Details</span>
        <Input label="Name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        <TextArea
          label="Description"
          placeholder="What does done look like?"
          value={description}
          maxLength={4000}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="pair pair--stack">
          <Input label="Deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          <Stepper label="Estimate" value={estimateHours} onChange={setEstimateHours} min={0} max={10000} unit="hours" />
        </div>
        <Button type="submit" title={dirty ? 'Save details' : 'Saved'} size="sm" loading={saving} disabled={!dirty || !name.trim()} />
      </form>
    </Card>
  )
}

export default function ProjectDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const project = useQuery({ queryKey: keys.project(id), queryFn: () => projectsApi.get(id) })

  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneWeight, setMilestoneWeight] = useState<(typeof WEIGHTS)[number]>('1')
  const [milestoneDue, setMilestoneDue] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/projects'))

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.project(id) }),
      queryClient.invalidateQueries({ queryKey: keys.projects, exact: true }),
    ])
  }

  const run = async (key: string, action: () => Promise<unknown>, failure: string) => {
    setBusy(key)
    try {
      await action()
      await refresh()
      return true
    } catch (error) {
      toast(describeError(error), { title: failure, tone: 'error' })
      return false
    } finally {
      setBusy(null)
    }
  }

  const addMilestone = async (event: FormEvent) => {
    event.preventDefault()
    if (!milestoneTitle.trim()) return
    const ok = await run(
      'milestone',
      () => projectsApi.addMilestone(id, { title: milestoneTitle.trim(), weight: Number(milestoneWeight), dueDate: milestoneDue || null }),
      'Could not add milestone',
    )
    if (ok) {
      setMilestoneTitle('')
      setMilestoneDue('')
      setMilestoneWeight('1')
    }
  }

  const toggleMilestone = (milestoneId: string) =>
    run(
      milestoneId,
      async () => {
        const result = await projectsApi.toggleMilestone(milestoneId)
        if (result.xpAwarded > 0) {
          setFlash(`+${result.xpAwarded} XP`)
          setTimeout(() => setFlash(null), 2400)
          void invalidateProgress()
        }
      },
      'Could not update milestone',
    )

  const logTime = async (event: FormEvent) => {
    event.preventDefault()
    const ok = await run('log', () => projectsApi.addWorkLog(id, { durationMinutes: minutes, note: note.trim() }), 'Could not log time')
    if (ok) setNote('')
  }

  const setStatus = (status: ProjectStatus) => run('status', () => projectsApi.update(id, { status }), 'Could not update project')

  const archive = async () => {
    const ok = await confirm({
      title: 'Archive project?',
      message: 'It leaves the Projects list. Tasks, milestones and logged time are kept.',
      confirmLabel: 'Archive',
      destructive: true,
    })
    if (ok && (await setStatus('ARCHIVED'))) back()
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete project?',
      message: 'Milestones and logged time are deleted for good. Its tasks stay, just without a project.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    setBusy('delete')
    try {
      await projectsApi.remove(id)
      await Promise.all([queryClient.invalidateQueries({ queryKey: keys.projects }), queryClient.invalidateQueries({ queryKey: keys.tasks })])
      navigate('/projects', { replace: true })
    } catch (error) {
      toast(describeError(error), { title: 'Could not delete project', tone: 'error' })
      setBusy(null)
    }
  }

  if (project.isPending) {
    return (
      <Screen bare>
        <LoadingState message="Loading project…" fullScreen />
      </Screen>
    )
  }

  if (project.isError) {
    return (
      <Screen bare>
        <PageHeader title="Project" onBack={back} />
        <ErrorState message={describeError(project.error)} onRetry={() => void project.refetch()} />
      </Screen>
    )
  }

  const data = project.data
  const done = data.milestones.filter((milestone) => milestone.done).length
  const daysLeft = data.deadline ? daysUntil(data.deadline) : null

  return (
    <Screen bare>
      <PageHeader
        title={data.name}
        subtitle={data.description || undefined}
        onBack={back}
        action={data.status === 'COMPLETED' ? <Chip label="done" variant="success" /> : null}
      />

      <div className="stats mb-lg">
        <Stat label="Logged" value={`${(data.totalMinutes / 60).toFixed(1)}h`} hint={data.estimatedMinutes ? `of ${Math.round(data.estimatedMinutes / 60)}h` : 'total'} />
        <Stat
          label="Milestones"
          value={`${done}/${data.milestones.length}`}
          tint={data.milestones.length > 0 && done === data.milestones.length ? 'var(--success)' : 'var(--primary-hover)'}
        />
        <Stat
          label="Deadline"
          value={daysLeft === null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d` : `${daysLeft}d`}
          hint={daysLeft === null ? 'none set' : daysLeft < 0 ? 'overdue' : 'left'}
          tint={daysLeft !== null && daysLeft <= 7 ? 'var(--warning)' : 'var(--primary-hover)'}
        />
      </div>

      {data.estimatedMinutes ? (
        <div className="level-bar">
          <div className="row between">
            <span className="t-label">Time vs estimate</span>
            <span className="t-caption">{formatMinutes(data.totalMinutes)} / {formatMinutes(data.estimatedMinutes)}</span>
          </div>
          <ProgressBar
            value={data.totalMinutes / data.estimatedMinutes}
            height={8}
            tint={data.totalMinutes > data.estimatedMinutes ? 'var(--warning)' : 'var(--primary)'}
          />
        </div>
      ) : null}

      {flash ? <p className="flash" role="status">{flash}</p> : null}

      <Card className="gap-lg mb-lg">
        <div className="row between">
          <span className="t-label">Milestones</span>
          {data.milestones.length ? <span className="t-caption">{done} of {data.milestones.length} done</span> : null}
        </div>

        {data.milestones.length > 0 ? (
          <div className="stack gap-sm">
            {data.milestones.map((milestone) => (
              <div key={milestone.id} className="list-item">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={milestone.done}
                  aria-label={milestone.title}
                  disabled={busy === milestone.id}
                  className={`list-item__check ${milestone.done ? 'list-item__check--done' : ''}`}
                  onClick={() => void toggleMilestone(milestone.id)}
                >
                  ✓
                </button>
                <div className="stack gap-xs grow">
                  <span className={`t-subheading ${milestone.done ? 'list-item__title--done' : ''}`}>{milestone.title}</span>
                  <div className="row wrap gap-xs">
                    {milestone.weight > 1 ? <Chip label={`weight ${milestone.weight}`} variant="accent" /> : null}
                    {milestone.dueDate ? <Chip label={`due ${prettyDay(milestone.dueDate)}`} variant={!milestone.done && daysUntil(milestone.dueDate) < 0 ? 'warning' : 'default'} /> : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="link-btn"
                  aria-label={`Delete ${milestone.title}`}
                  onClick={() => void run(milestone.id, () => projectsApi.deleteMilestone(milestone.id), 'Could not delete milestone')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No milestones yet" message="Break the project into checkpoints. Each one earns XP when you tick it off." icon="◆" />
        )}

        <form className="stack gap-md divider-top" onSubmit={(event) => void addMilestone(event)}>
          <Input label="New milestone" placeholder="First public beta" value={milestoneTitle} maxLength={160} onChange={(event) => setMilestoneTitle(event.target.value)} />
          <div className="pair pair--stack">
            <Input label="Due" type="date" value={milestoneDue} onChange={(event) => setMilestoneDue(event.target.value)} />
            <Segmented label="Weight" options={WEIGHTS} value={milestoneWeight} onChange={setMilestoneWeight} format={(option) => option} />
          </div>
          <Button type="submit" title="Add milestone" size="sm" variant="secondary" loading={busy === 'milestone'} disabled={!milestoneTitle.trim()} />
        </form>
      </Card>

      <Card className="gap-lg mb-lg">
        <span className="t-label">Log time</span>
        <form className="stack gap-md" onSubmit={(event) => void logTime(event)}>
          <div className="pair pair--stack">
            <Stepper label="Duration" value={minutes} onChange={setMinutes} min={5} max={1440} step={15} unit="min" />
            <Input label="Note" placeholder="Optional" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </div>
          <Button type="submit" title="Log time" size="sm" loading={busy === 'log'} />
        </form>

        {data.workLogs.length > 0 ? (
          <div className="stack gap-sm divider-top">
            {data.workLogs.map((log) => (
              <div key={log.id} className="list-item">
                <div className="stack gap-xs grow">
                  <div className="row gap-sm">
                    <span className="t-subheading t-timer">{formatMinutes(log.durationMinutes)}</span>
                    <span className="t-caption">{prettyDay(log.day)}</span>
                  </div>
                  {log.note ? <span className="t-caption t-faint">{log.note}</span> : null}
                </div>
                <button
                  type="button"
                  className="link-btn"
                  aria-label="Delete this entry"
                  onClick={() => void run(log.id, () => projectsApi.deleteWorkLog(log.id), 'Could not delete entry')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <DetailsCard key={data.id} project={data} onSaved={refresh} />

      <Card className="gap-md">
        <span className="t-label">Status</span>
        <div className="row wrap gap-xs">
          <DeadlineChip deadline={data.deadline} />
          <Chip label={`${data.taskCount} tasks`} />
        </div>
        {data.status === 'ACTIVE' ? (
          <Button title="Mark as complete" variant="secondary" fullWidth loading={busy === 'status'} onClick={() => void setStatus('COMPLETED')} />
        ) : (
          <Button title="Reopen project" variant="secondary" fullWidth loading={busy === 'status'} onClick={() => void setStatus('ACTIVE')} />
        )}
        <Button title="Archive" variant="ghost" fullWidth onClick={() => void archive()} />
        <Button title="Delete project" variant="danger" fullWidth loading={busy === 'delete'} onClick={() => void remove()} />
      </Card>
    </Screen>
  )
}
