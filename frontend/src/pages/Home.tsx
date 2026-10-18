import { useState } from 'react'
import { Link } from 'react-router'
import type { TaskWithEntry } from '@/api/types'
import { TaskRow } from '@/components/TaskRow'
import { ProgressBar, Stat } from '@/components/ui'

const FEATURES = [
  { icon: '◉', title: 'Daily tasks & streaks', body: 'Recurring tasks with targets and active days. Finish them all to keep your streak alive.' },
  { icon: '★', title: 'XP and levels', body: 'Every completed task earns XP. Clear the whole day for a perfect-day bonus and level up.' },
  { icon: '◆', title: 'Projects & milestones', body: 'Break big goals into milestones, log the hours you put in and keep an eye on the deadline.' },
  { icon: '⇄', title: 'Connected apps', body: 'Link LeetCode, Duolingo and VelocityFit. Progress there ticks off your tasks automatically.' },
  { icon: '◷', title: 'Reminders & countdown', body: 'Nudges at the time you pick, plus a countdown to midnight when tasks are still open.' },
  { icon: '▤', title: 'History', body: 'See how every day went and how consistent you have been over the past weeks.' },
]

const STEPS = [
  { title: 'Create a free account', body: 'One account works on the website and in the mobile app.' },
  { title: 'Add your recurring tasks', body: 'Workouts, reading, water, practice — whatever you want to do every day.' },
  { title: 'Check them off and level up', body: 'Earn XP, build streaks and watch your history fill up.' },
]

const PREVIEW_TASKS: TaskWithEntry[] = [
  preview('workout', 'Morning workout', 3, 'sets', 2, { priority: 'HIGH' }),
  preview('read', 'Read 20 pages', 1, 'times', 0),
  preview('leetcode', 'Solve a LeetCode problem', 1, 'times', 1, { autoTracked: true }),
]

function preview(
  id: string,
  title: string,
  target: number,
  unit: string,
  progress: number,
  extra: { priority?: TaskWithEntry['priority']; autoTracked?: boolean } = {},
): TaskWithEntry {
  return {
    id,
    projectId: null,
    projectName: null,
    title,
    description: '',
    category: 'CUSTOM',
    provider: 'MANUAL',
    target,
    unit,
    activeDays: [],
    priority: extra.priority ?? 'MEDIUM',
    cadence: 'DAILY',
    paused: false,
    entry: { progress, target, completed: progress >= target, autoTracked: extra.autoTracked ?? false },
  }
}

/** A playable copy of the Today screen, so visitors can feel the app before signing up. */
function TodayPreview() {
  const [tasks, setTasks] = useState(PREVIEW_TASKS)
  const done = tasks.filter((task) => task.entry.completed).length
  const xp = 120 + done * 10 + (done === tasks.length ? 25 : 0)

  const set = (id: string, next: (task: TaskWithEntry) => number) =>
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task
        const progress = Math.max(0, Math.min(task.target, next(task)))
        return { ...task, entry: { ...task.entry, progress, completed: progress >= task.target } }
      }),
    )

  return (
    <div className="home-preview" aria-label="Preview of the Today screen">
      <div className="home-preview__bar" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="home-preview__body">
        <span className="page-header__eyebrow">TODAY</span>
        <div className="stats mb-lg">
          <Stat label="Level" value={2} hint={`${xp} XP total`} />
          <Stat label="Streak" value={done === tasks.length ? 13 : 12} hint="days" tint="var(--warning)" />
          <Stat
            label="Today"
            value={`${done}/${tasks.length}`}
            tint={done === tasks.length ? 'var(--success)' : 'var(--primary-hover)'}
          />
        </div>
        <div className="level-bar">
          <div className="row between">
            <span className="t-label">Level 2</span>
            <span className="t-caption">{xp - 100} / 100 XP</span>
          </div>
          <ProgressBar value={(xp - 100) / 100} height={8} />
        </div>
        <div className="stack gap-sm">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => set(task.id, (current) => (current.entry.completed ? 0 : current.target))}
              onStep={(delta) => set(task.id, (current) => current.entry.progress + delta)}
            />
          ))}
        </div>
        <p className="t-caption t-faint home-preview__hint">
          {done === tasks.length ? 'Perfect day! Your streak just grew.' : 'Try it — tap a task to check it off.'}
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="home">
      <header className="home-nav">
        <Link to="/" className="home-nav__brand">
          <img src="/icon-192.png" alt="" width={32} height={32} />
          <span>LevelUp</span>
        </Link>
        <nav className="row gap-sm">
          <Link to="/login" className="btn btn--ghost btn--sm">Sign in</Link>
          <Link to="/register" className="btn btn--primary btn--sm home-nav__cta">Get started</Link>
        </nav>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-hero__copy">
            <span className="page-header__eyebrow">LEVEL UP</span>
            <h1 className="home-hero__title">
              Turn your daily habits into <span className="home-gradient">XP</span>.
            </h1>
            <p className="home-hero__lead">
              Recurring tasks, streaks, projects and connected apps in one place. Check things off, earn XP and level
              up — on the web and on your phone.
            </p>
            <div className="home-hero__actions">
              <Link to="/register" className="btn btn--primary btn--lg">Create free account</Link>
              <Link to="/login" className="btn btn--secondary btn--lg">I have an account</Link>
            </div>
            <p className="t-caption t-faint">Free to use. Your progress syncs with the LevelUp mobile app.</p>
          </div>
          <TodayPreview />
        </section>

        <section className="home-section" aria-labelledby="features-title">
          <h2 id="features-title" className="home-section__title">Everything the app does, in your browser</h2>
          <div className="home-features">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="card home-feature">
                <span className="home-feature__icon" aria-hidden>{feature.icon}</span>
                <h3 className="t-subheading">{feature.title}</h3>
                <p className="t-body-muted">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section" aria-labelledby="steps-title">
          <h2 id="steps-title" className="home-section__title">Up and running in a minute</h2>
          <ol className="home-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="home-step">
                <span className="home-step__num">{index + 1}</span>
                <div className="stack gap-xs">
                  <h3 className="t-subheading">{step.title}</h3>
                  <p className="t-body-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-cta card card--accent">
          <h2 className="t-title">Ready to level up?</h2>
          <p className="t-body-muted">Start your first streak today.</p>
          <Link to="/register" className="btn btn--primary btn--lg">Get started for free</Link>
        </section>
      </main>

      <footer className="home-footer">© {new Date().getFullYear()} LevelUp</footer>
    </div>
  )
}
