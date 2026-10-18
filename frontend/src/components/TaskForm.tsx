import { useState, type FormEvent } from 'react'
import {
  CADENCES,
  CATEGORIES,
  PRIORITIES,
  PROVIDER_LABELS,
  PROVIDERS,
  type ProjectSummary,
  type TaskInput,
} from '@/api/types'
import { Button, Input, Segmented, Stepper, TextArea } from './ui'

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

interface TaskFormProps {
  initial: TaskInput
  projects: ProjectSummary[]
  submitLabel: string
  saving?: boolean
  onSubmit: (input: TaskInput) => void
}

export function TaskForm({ initial, projects, submitLabel, saving, onSubmit }: TaskFormProps) {
  const [form, setForm] = useState<TaskInput>(initial)
  const [error, setError] = useState<string | null>(null)

  const patch = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleDay = (day: number) =>
    setForm((prev) => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter((value) => value !== day)
        : [...prev.activeDays, day].sort(),
    }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setError('Give the task a title.')
      return
    }
    if (!Number.isInteger(form.target) || form.target < 1) {
      setError('Target has to be a whole number of at least 1.')
      return
    }
    setError(null)
    onSubmit({ ...form, title: form.title.trim(), unit: form.unit.trim() || 'times' })
  }

  return (
    <form className="stack gap-xl" style={{ paddingBottom: 'var(--xxxl)' }} onSubmit={submit} noValidate>
      <Input
        label="Title"
        placeholder="Drink water"
        value={form.title}
        maxLength={120}
        autoFocus={!initial.title}
        onChange={(event) => patch('title', event.target.value)}
      />

      <TextArea
        label="Notes"
        placeholder="Optional"
        value={form.description}
        maxLength={2000}
        onChange={(event) => patch('description', event.target.value)}
      />

      <div className="pair">
        <Stepper label="Target" value={form.target} onChange={(next) => patch('target', next)} min={1} />
        <Input
          label="Unit"
          placeholder="glasses"
          value={form.unit}
          maxLength={30}
          onChange={(event) => patch('unit', event.target.value)}
        />
      </div>

      <Segmented label="Cadence" options={CADENCES} value={form.cadence} onChange={(next) => patch('cadence', next)} />

      <Segmented label="Priority" options={PRIORITIES} value={form.priority} onChange={(next) => patch('priority', next)} />

      <Segmented label="Category" options={CATEGORIES} value={form.category} onChange={(next) => patch('category', next)} />

      <div className="stack gap-sm">
        <Segmented
          label="Tracked by"
          options={PROVIDERS}
          value={form.provider}
          onChange={(next) => patch('provider', next)}
          format={(option) => PROVIDER_LABELS[option]}
        />
        <span className="t-caption t-faint">
          {form.provider === 'MANUAL'
            ? 'You tick this off yourself.'
            : `Syncing ${PROVIDER_LABELS[form.provider]} can complete this for you. Connect it on the Apps tab.`}
        </span>
      </div>

      {form.cadence === 'DAILY' ? (
        <div className="stack gap-sm">
          <span className="t-label">Active days</span>
          <span className="t-caption t-faint">Leave all off for every day.</span>
          <div className="day-row">
            {WEEKDAYS.map((day) => {
              const active = form.activeDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  className={`day-btn ${active ? 'active' : ''}`}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {projects.length > 0 ? (
        <Segmented
          label="Project"
          options={['none', ...projects.map((project) => project.id)]}
          value={form.projectId ?? 'none'}
          onChange={(next) => patch('projectId', next === 'none' ? null : next)}
          format={(option) =>
            option === 'none' ? 'None' : projects.find((project) => project.id === option)?.name ?? 'Project'
          }
        />
      ) : null}

      {error ? <p className="t-body t-danger" role="alert">{error}</p> : null}

      <Button type="submit" title={submitLabel} loading={saving} fullWidth />
    </form>
  )
}
