import type { TaskWithEntry } from '@/api/types'
import { Chip, IconButton, ProgressBar } from './ui'

interface TaskRowProps {
  task: TaskWithEntry
  onToggle: () => void
  onStep: (delta: number) => void
  disabled?: boolean
}

export function TaskRow({ task, onToggle, onStep, disabled }: TaskRowProps) {
  const { entry } = task
  const done = entry.completed
  // A target of 1 is a plain checkbox; anything higher gets a counter.
  const counted = task.target > 1

  return (
    <div className={`task-row ${done ? 'task-row--done' : ''}`}>
      <button
        type="button"
        className="task-row__main"
        onClick={onToggle}
        disabled={disabled}
        role="checkbox"
        aria-checked={done}
        aria-label={task.title}
      >
        <span className="task-row__box" aria-hidden>✓</span>

        <span className="task-row__body">
          <span className="task-row__title clamp-2">{task.title}</span>

          <span className="row wrap gap-xs">
            {counted ? (
              <span className="task-row__count">
                {entry.progress} / {task.target} {task.unit}
              </span>
            ) : null}
            {task.cadence === 'WEEKLY' ? <Chip label="Weekly" variant="accent" /> : null}
            {task.priority === 'URGENT' || task.priority === 'HIGH' ? (
              <Chip label={task.priority.toLowerCase()} variant="warning" />
            ) : null}
            {task.projectName ? <Chip label={task.projectName} /> : null}
            {entry.autoTracked ? <Chip label="synced" variant="success" /> : null}
          </span>

          {counted ? (
            <span style={{ marginTop: 'var(--xs)' }}>
              <ProgressBar
                value={task.target ? entry.progress / task.target : 0}
                tint={done ? 'var(--success)' : 'var(--primary)'}
              />
            </span>
          ) : null}
        </span>
      </button>

      {counted ? (
        <div className="task-row__steppers">
          <IconButton label="−" ariaLabel={`Remove one from ${task.title}`} onClick={() => onStep(-1)} disabled={disabled || entry.progress <= 0} />
          <IconButton label="+" ariaLabel={`Add one to ${task.title}`} onClick={() => onStep(1)} disabled={disabled || entry.progress >= task.target} />
        </div>
      ) : null}
    </div>
  )
}
