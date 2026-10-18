import { Router } from 'express'
import { z } from 'zod'
import { CADENCES, CATEGORIES, PRIORITIES, PROVIDERS } from '../domain/constants.js'
import { today } from '../lib/dates.js'
import { id, idParam, isoDay } from '../lib/validation.js'
import { authOf } from '../middleware/auth.js'
import * as tasks from '../services/taskService.js'
import { getXpSummary } from '../services/xpService.js'

const taskInput = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(120),
  description: z.string().trim().max(2000).default(''),
  category: z.enum(CATEGORIES).default('CUSTOM'),
  provider: z.enum(PROVIDERS).default('MANUAL'),
  target: z.number().int().min(1, 'Target has to be at least 1').max(9999),
  unit: z.string().trim().max(30).transform((value) => value || 'times').default('times'),
  activeDays: z
    .array(z.number().int().min(1).max(7))
    .max(7)
    .transform((days) => [...new Set(days)].sort())
    .default([]),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  cadence: z.enum(CADENCES).default('DAILY'),
  projectId: id.nullable().default(null),
})

const dayQuery = z.object({ day: isoDay.optional() })

/** The client may name a day (to look back), otherwise it's today in the caller's timezone. */
function resolveDay(timezone: string, day: string | undefined): string {
  return day ?? today(timezone)
}

export const tasksRouter = Router()

tasksRouter.get('/today', async (request, response) => {
  const { userId, timezone } = authOf(request)
  const day = resolveDay(timezone, dayQuery.parse(request.query).day)
  const [dayTasks, streak, xp] = await Promise.all([
    tasks.getDay(userId, day),
    tasks.currentStreak(userId, today(timezone)),
    getXpSummary(userId, day),
  ])
  response.json({ day, streak, tasks: dayTasks, xp })
})

tasksRouter.get('/history', async (request, response) => {
  const { userId, timezone } = authOf(request)
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(366).default(7) }).parse(request.query)
  const now = today(timezone)
  const [rows, streak] = await Promise.all([tasks.history(userId, now, days), tasks.currentStreak(userId, now)])
  response.json({ days: rows, streak })
})

tasksRouter.get('/tasks', async (request, response) => {
  response.json({ tasks: await tasks.listTasks(authOf(request).userId) })
})

tasksRouter.post('/tasks', async (request, response) => {
  const input = taskInput.parse(request.body)
  response.status(201).json({ task: await tasks.createTask(authOf(request).userId, input) })
})

tasksRouter.get('/tasks/:id', async (request, response) => {
  const { id: taskId } = idParam.parse(request.params)
  response.json({ task: await tasks.getTask(authOf(request).userId, taskId) })
})

tasksRouter.put('/tasks/:id', async (request, response) => {
  const { id: taskId } = idParam.parse(request.params)
  const input = taskInput.parse(request.body)
  response.json({ task: await tasks.updateTask(authOf(request).userId, taskId, input) })
})

tasksRouter.post('/tasks/:id/pause', async (request, response) => {
  const { id: taskId } = idParam.parse(request.params)
  const { paused } = z.object({ paused: z.boolean() }).parse(request.body)
  response.json({ task: await tasks.setPaused(authOf(request).userId, taskId, paused) })
})

tasksRouter.delete('/tasks/:id', async (request, response) => {
  const { id: taskId } = idParam.parse(request.params)
  await tasks.archiveTask(authOf(request).userId, taskId)
  response.status(204).end()
})

tasksRouter.post('/tasks/:id/toggle', async (request, response) => {
  const { userId, timezone } = authOf(request)
  const { id: taskId } = idParam.parse(request.params)
  const { day } = dayQuery.parse(request.body ?? {})
  response.json(await tasks.toggle(userId, taskId, resolveDay(timezone, day)))
})

tasksRouter.put('/tasks/:id/progress', async (request, response) => {
  const { userId, timezone } = authOf(request)
  const { id: taskId } = idParam.parse(request.params)
  const { progress, day } = z
    .object({ progress: z.number().int().min(0).max(9999), day: isoDay.optional() })
    .parse(request.body)
  response.json(await tasks.setProgress(userId, taskId, resolveDay(timezone, day), progress))
})
