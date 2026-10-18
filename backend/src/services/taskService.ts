import type { Provider, TargetCadence, TaskCategory, TaskPriority } from '../generated/prisma/enums.js'
import type { Prisma } from '../generated/prisma/client.js'
import { isoWeekday, recentDays, shiftDay, weekKey, weekStart } from '../lib/dates.js'
import { notFound } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { awardPerfectDayXp, awardTaskXp } from './xpService.js'

export interface Task {
  id: string
  projectId: string | null
  projectName: string | null
  title: string
  description: string
  category: TaskCategory
  provider: Provider
  target: number
  unit: string
  activeDays: number[]
  priority: TaskPriority
  cadence: TargetCadence
  paused: boolean
}

export interface TaskEntry {
  progress: number
  target: number
  completed: boolean
  autoTracked: boolean
}

export interface TaskWithEntry extends Task {
  entry: TaskEntry
}

export interface ProgressResult {
  progress: number
  completed: boolean
  xpAwarded: number
}

export interface HistoryDay {
  day: string
  total: number
  completed: number
  percent: number
}

export interface TaskInput {
  title: string
  description: string
  category: TaskCategory
  provider: Provider
  target: number
  unit: string
  activeDays: number[]
  priority: TaskPriority
  cadence: TargetCadence
  projectId: string | null
}

const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  category: true,
  provider: true,
  target: true,
  unit: true,
  activeDays: true,
  priority: true,
  cadence: true,
  pausedAt: true,
  createdAt: true,
  project: { select: { name: true } },
} satisfies Prisma.TaskSelect

type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    title: row.title,
    description: row.description,
    category: row.category,
    provider: row.provider,
    target: row.target,
    unit: row.unit,
    activeDays: row.activeDays,
    priority: row.priority,
    cadence: row.cadence,
    paused: row.pausedAt !== null,
  }
}

export function isScheduledOn(task: Pick<Task, 'paused' | 'cadence' | 'activeDays'>, day: string): boolean {
  if (task.paused) return false
  if (task.cadence === 'WEEKLY') return true
  return task.activeDays.length === 0 || task.activeDays.includes(isoWeekday(day))
}

/** Weekly tasks share one entry per ISO week, keyed to its Monday; daily tasks get one per day. */
export function entryPeriod(cadence: TargetCadence, day: string): { periodKey: string; entryDay: string } {
  return cadence === 'WEEKLY'
    ? { periodKey: weekKey(day), entryDay: weekStart(day) }
    : { periodKey: day, entryDay: day }
}

async function assertProjectOwned(userId: string, projectId: string | null): Promise<void> {
  if (!projectId) return
  const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!project) throw notFound('Project')
}

export async function listTasks(userId: string): Promise<Task[]> {
  const rows = await prisma.task.findMany({
    where: { userId, archivedAt: null },
    select: taskSelect,
    orderBy: { createdAt: 'desc' },
  })
  return rows
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .map(toTask)
}

export async function getTask(userId: string, taskId: string): Promise<Task> {
  const row = await prisma.task.findFirst({ where: { id: taskId, userId }, select: taskSelect })
  if (!row) throw notFound('Task')
  return toTask(row)
}

/** Tasks scheduled for `day`, creating any missing entries so progress has somewhere to land. */
export async function getDay(userId: string, day: string): Promise<TaskWithEntry[]> {
  const rows = await prisma.task.findMany({
    where: { userId, archivedAt: null, pausedAt: null },
    select: taskSelect,
    orderBy: { createdAt: 'asc' },
  })

  const scheduled = rows.map(toTask).filter((task) => isScheduledOn(task, day))
  if (scheduled.length === 0) return []

  const periods = scheduled.map((task) => entryPeriod(task.cadence, day))

  await prisma.taskEntry.createMany({
    data: scheduled.map((task, index) => ({
      taskId: task.id,
      userId,
      day: periods[index]!.entryDay,
      periodKey: periods[index]!.periodKey,
      target: task.target,
    })),
    skipDuplicates: true,
  })

  const entries = await prisma.taskEntry.findMany({
    where: {
      taskId: { in: scheduled.map((task) => task.id) },
      periodKey: { in: [...new Set(periods.map((period) => period.periodKey))] },
    },
    select: { taskId: true, periodKey: true, progress: true, target: true, completed: true, autoTracked: true },
  })

  const byKey = new Map(entries.map((entry) => [`${entry.taskId}|${entry.periodKey}`, entry]))

  return scheduled.flatMap((task, index) => {
    const entry = byKey.get(`${task.id}|${periods[index]!.periodKey}`)
    if (!entry) return []
    return [{
      ...task,
      entry: {
        progress: entry.progress,
        target: entry.target,
        completed: entry.completed,
        autoTracked: entry.autoTracked,
      },
    }]
  })
}

export async function setProgress(
  userId: string,
  taskId: string,
  day: string,
  progress: number,
  options: { autoTracked?: boolean } = {},
): Promise<ProgressResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, target: true, priority: true, cadence: true },
  })
  if (!task) throw notFound('Task')

  const period = entryPeriod(task.cadence, day)
  const previous = await prisma.taskEntry.findUnique({
    where: { taskId_periodKey: { taskId, periodKey: period.periodKey } },
    select: { completed: true },
  })

  const clamped = Math.max(0, Math.min(progress, task.target))
  const completed = clamped >= task.target
  const state = {
    target: task.target,
    progress: clamped,
    completed,
    autoTracked: options.autoTracked ?? false,
    completedAt: completed ? new Date() : null,
  }

  const entry = await prisma.taskEntry.upsert({
    where: { taskId_periodKey: { taskId, periodKey: period.periodKey } },
    create: { taskId, userId, day: period.entryDay, periodKey: period.periodKey, ...state },
    update: state,
    select: { progress: true, completed: true },
  })

  let xpAwarded = 0

  // Only the transition into "completed" earns XP, so re-tapping a finished task is free.
  if (completed && !previous?.completed) {
    xpAwarded += await awardTaskXp(userId, taskId, task.priority, period.periodKey, day)

    if (task.cadence === 'DAILY') {
      const daily = (await getDay(userId, day)).filter((item) => item.cadence === 'DAILY')
      if (daily.length > 0 && daily.every((item) => item.entry.completed)) {
        xpAwarded += await awardPerfectDayXp(userId, day)
      }
    }
  }

  return { progress: entry.progress, completed: entry.completed, xpAwarded }
}

export async function toggle(userId: string, taskId: string, day: string): Promise<ProgressResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { target: true, cadence: true },
  })
  if (!task) throw notFound('Task')

  const entry = await prisma.taskEntry.findUnique({
    where: { taskId_periodKey: { taskId, periodKey: entryPeriod(task.cadence, day).periodKey } },
    select: { completed: true },
  })

  return setProgress(userId, taskId, day, entry?.completed ? 0 : task.target)
}

interface DayBucket {
  day: string
  total: number
  done: number
}

async function dayBuckets(userId: string, days: string[], dailyOnly: boolean): Promise<Map<string, DayBucket>> {
  const from = days[0]
  const to = days[days.length - 1]
  if (!from || !to) return new Map()

  const rows = dailyOnly
    ? await prisma.$queryRaw<DayBucket[]>`
        SELECT e.day, COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE e.completed))::int AS done
        FROM "TaskEntry" e
        JOIN "Task" t ON t.id = e."taskId"
        WHERE e."userId" = ${userId} AND t.cadence = 'DAILY' AND e.day BETWEEN ${from} AND ${to}
        GROUP BY e.day`
    : await prisma.$queryRaw<DayBucket[]>`
        SELECT e.day, COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE e.completed))::int AS done
        FROM "TaskEntry" e
        WHERE e."userId" = ${userId} AND e.day BETWEEN ${from} AND ${to}
        GROUP BY e.day`

  return new Map(rows.map((row) => [row.day, row]))
}

/**
 * Consecutive days where every scheduled daily task was completed. Today only
 * counts once it's fully done, so an unfinished today doesn't break the run.
 */
export async function currentStreak(userId: string, today: string): Promise<number> {
  const byDay = await dayBuckets(userId, recentDays(366, today), true)

  let streak = 0
  const todayBucket = byDay.get(today)
  if (todayBucket?.total && todayBucket.done === todayBucket.total) streak += 1

  let cursor = shiftDay(today, -1)
  for (;;) {
    const bucket = byDay.get(cursor)
    if (!bucket?.total || bucket.done < bucket.total) break
    streak += 1
    cursor = shiftDay(cursor, -1)
  }
  return streak
}

export async function history(userId: string, today: string, days: number): Promise<HistoryDay[]> {
  const range = recentDays(days, today)
  const byDay = await dayBuckets(userId, range, false)

  return range.map((day) => {
    const bucket = byDay.get(day)
    const total = bucket?.total ?? 0
    const completed = bucket?.done ?? 0
    return { day, total, completed, percent: total ? Math.round((completed / total) * 100) : 0 }
  })
}

export async function createTask(userId: string, input: TaskInput): Promise<Task> {
  await assertProjectOwned(userId, input.projectId)
  const row = await prisma.task.create({ data: { ...input, userId }, select: taskSelect })
  return toTask(row)
}

export async function updateTask(userId: string, taskId: string, input: TaskInput): Promise<Task> {
  await assertProjectOwned(userId, input.projectId)
  const { count } = await prisma.task.updateMany({ where: { id: taskId, userId }, data: input })
  if (!count) throw notFound('Task')
  return getTask(userId, taskId)
}

export async function setPaused(userId: string, taskId: string, paused: boolean): Promise<Task> {
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, userId },
    data: { pausedAt: paused ? new Date() : null },
  })
  if (!count) throw notFound('Task')
  return getTask(userId, taskId)
}

/** Archives rather than deletes, so past history is kept. */
export async function archiveTask(userId: string, taskId: string): Promise<void> {
  const { count } = await prisma.task.updateMany({
    where: { id: taskId, userId },
    data: { archivedAt: new Date() },
  })
  if (!count) throw notFound('Task')
}
