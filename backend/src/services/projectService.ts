import type { ProjectStatus } from '../generated/prisma/enums.js'
import { dateOnly, toDateColumn } from '../lib/dates.js'
import { notFound } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { awardMilestoneXp } from './xpService.js'

export interface Project {
  id: string
  name: string
  description: string
  deadline: string | null
  status: ProjectStatus
  estimatedMinutes: number | null
}

export interface ProjectSummary extends Project {
  taskCount: number
  totalMinutes: number
  milestoneCount: number
  milestonesDone: number
}

export interface ProjectMilestone {
  id: string
  title: string
  weight: number
  dueDate: string | null
  done: boolean
}

export interface ProjectWorkLog {
  id: string
  durationMinutes: number
  day: string
  note: string
}

export interface ProjectDetail extends Project {
  milestones: ProjectMilestone[]
  workLogs: ProjectWorkLog[]
  totalMinutes: number
  taskCount: number
}

export interface ProjectInput {
  name: string
  description: string
  deadline: string | null
  estimatedMinutes: number | null
}

const projectSelect = {
  id: true,
  name: true,
  description: true,
  deadline: true,
  status: true,
  estimatedMinutes: true,
} as const

function toProject(row: {
  id: string
  name: string
  description: string
  deadline: Date | null
  status: ProjectStatus
  estimatedMinutes: number | null
}): Project {
  return { ...row, deadline: dateOnly(row.deadline) }
}

const STATUS_RANK: Record<ProjectStatus, number> = { ACTIVE: 0, COMPLETED: 1, ARCHIVED: 2 }

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const projects = await prisma.project.findMany({
    where: { userId, status: { not: 'ARCHIVED' } },
    select: {
      ...projectSelect,
      createdAt: true,
      _count: { select: { tasks: { where: { archivedAt: null } }, milestones: true } },
    },
    orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  })
  if (projects.length === 0) return []

  const ids = projects.map((project) => project.id)
  const [minutes, done] = await Promise.all([
    prisma.projectWorkLog.groupBy({
      by: ['projectId'],
      where: { projectId: { in: ids } },
      _sum: { durationMinutes: true },
    }),
    prisma.projectMilestone.groupBy({
      by: ['projectId'],
      where: { projectId: { in: ids }, completedAt: { not: null } },
      _count: { _all: true },
    }),
  ])

  const minutesBy = new Map(minutes.map((row) => [row.projectId, row._sum.durationMinutes ?? 0]))
  const doneBy = new Map(done.map((row) => [row.projectId, row._count._all]))

  return projects
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    .map(({ _count, createdAt: _createdAt, ...row }) => ({
      ...toProject(row),
      taskCount: _count.tasks,
      milestoneCount: _count.milestones,
      milestonesDone: doneBy.get(row.id) ?? 0,
      totalMinutes: minutesBy.get(row.id) ?? 0,
    }))
}

export async function getProject(userId: string, projectId: string): Promise<ProjectDetail> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { ...projectSelect, _count: { select: { tasks: { where: { archivedAt: null } } } } },
  })
  if (!project) throw notFound('Project')

  const [milestones, workLogs, total] = await Promise.all([
    prisma.projectMilestone.findMany({
      where: { projectId },
      select: { id: true, title: true, weight: true, dueDate: true, completedAt: true, createdAt: true },
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    }),
    prisma.projectWorkLog.findMany({
      where: { projectId },
      select: { id: true, durationMinutes: true, day: true, note: true },
      orderBy: [{ day: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    }),
    prisma.projectWorkLog.aggregate({ where: { projectId }, _sum: { durationMinutes: true } }),
  ])

  const { _count, ...row } = project
  return {
    ...toProject(row),
    taskCount: _count.tasks,
    // Open milestones first, then by due date.
    milestones: milestones
      .map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        weight: milestone.weight,
        dueDate: dateOnly(milestone.dueDate),
        done: milestone.completedAt !== null,
      }))
      .sort((a, b) => Number(a.done) - Number(b.done)),
    workLogs,
    totalMinutes: total._sum.durationMinutes ?? 0,
  }
}

export async function createProject(userId: string, input: ProjectInput): Promise<Project> {
  const row = await prisma.project.create({
    data: { ...input, userId, deadline: toDateColumn(input.deadline) },
    select: projectSelect,
  })
  return toProject(row)
}

export async function updateProject(userId: string, projectId: string, input: Partial<ProjectInput> & { status?: ProjectStatus }): Promise<Project> {
  const { deadline, ...rest } = input
  const { count } = await prisma.project.updateMany({
    where: { id: projectId, userId },
    data: { ...rest, ...(deadline !== undefined ? { deadline: toDateColumn(deadline) } : {}) },
  })
  if (!count) throw notFound('Project')
  const row = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: projectSelect })
  return toProject(row)
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  const { count } = await prisma.project.deleteMany({ where: { id: projectId, userId } })
  if (!count) throw notFound('Project')
}

async function assertOwned(userId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!project) throw notFound('Project')
}

export async function addMilestone(
  userId: string,
  projectId: string,
  input: { title: string; weight: number; dueDate: string | null },
): Promise<ProjectMilestone> {
  await assertOwned(userId, projectId)
  const row = await prisma.projectMilestone.create({
    data: { projectId, userId, title: input.title, weight: input.weight, dueDate: toDateColumn(input.dueDate) },
  })
  return { id: row.id, title: row.title, weight: row.weight, dueDate: dateOnly(row.dueDate), done: false }
}

/** Flips a milestone's completion. Completing one awards XP, which idempotency makes safe to repeat. */
export async function toggleMilestone(
  userId: string,
  milestoneId: string,
  day: string,
): Promise<{ done: boolean; xpAwarded: number }> {
  const milestone = await prisma.projectMilestone.findFirst({
    where: { id: milestoneId, userId },
    select: { id: true, weight: true, completedAt: true },
  })
  if (!milestone) throw notFound('Milestone')

  const done = milestone.completedAt === null
  await prisma.projectMilestone.update({
    where: { id: milestone.id },
    data: { completedAt: done ? new Date() : null },
  })

  const xpAwarded = done ? await awardMilestoneXp(userId, milestone.id, milestone.weight, day) : 0
  return { done, xpAwarded }
}

export async function deleteMilestone(userId: string, milestoneId: string): Promise<void> {
  const { count } = await prisma.projectMilestone.deleteMany({ where: { id: milestoneId, userId } })
  if (!count) throw notFound('Milestone')
}

export async function addWorkLog(
  userId: string,
  projectId: string,
  input: { durationMinutes: number; note: string; day: string },
): Promise<ProjectWorkLog> {
  await assertOwned(userId, projectId)
  return prisma.projectWorkLog.create({
    data: { projectId, userId, ...input },
    select: { id: true, durationMinutes: true, day: true, note: true },
  })
}

export async function deleteWorkLog(userId: string, logId: string): Promise<void> {
  const { count } = await prisma.projectWorkLog.deleteMany({ where: { id: logId, userId } })
  if (!count) throw notFound('Work log')
}
