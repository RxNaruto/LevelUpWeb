import { Router } from 'express'
import { z } from 'zod'
import { today } from '../lib/dates.js'
import { idParam, isoDay } from '../lib/validation.js'
import { authOf } from '../middleware/auth.js'
import * as projects from '../services/projectService.js'

const projectInput = z.object({
  name: z.string().trim().min(1, 'Give the project a name').max(120),
  description: z.string().trim().max(4000).default(''),
  deadline: isoDay.nullable().default(null),
  estimatedMinutes: z.number().int().min(1).max(1_000_000).nullable().default(null),
})

const projectPatch = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(4000),
    deadline: isoDay.nullable(),
    estimatedMinutes: z.number().int().min(1).max(1_000_000).nullable(),
    status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']),
  })
  .partial()

const milestoneInput = z.object({
  title: z.string().trim().min(1, 'Give the milestone a title').max(160),
  weight: z.number().int().min(1).max(4).default(1),
  dueDate: isoDay.nullable().default(null),
})

const workLogInput = z.object({
  durationMinutes: z.number().int().min(1, 'Log at least a minute').max(24 * 60),
  note: z.string().trim().max(500).default(''),
  day: isoDay.optional(),
})

export const projectsRouter = Router()

projectsRouter.get('/projects', async (request, response) => {
  response.json({ projects: await projects.listProjects(authOf(request).userId) })
})

projectsRouter.post('/projects', async (request, response) => {
  const input = projectInput.parse(request.body)
  response.status(201).json({ project: await projects.createProject(authOf(request).userId, input) })
})

projectsRouter.get('/projects/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  response.json({ project: await projects.getProject(authOf(request).userId, id) })
})

projectsRouter.patch('/projects/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  const input = projectPatch.parse(request.body)
  response.json({ project: await projects.updateProject(authOf(request).userId, id, input) })
})

projectsRouter.delete('/projects/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  await projects.deleteProject(authOf(request).userId, id)
  response.status(204).end()
})

projectsRouter.post('/projects/:id/milestones', async (request, response) => {
  const { id } = idParam.parse(request.params)
  const input = milestoneInput.parse(request.body)
  response.status(201).json({ milestone: await projects.addMilestone(authOf(request).userId, id, input) })
})

projectsRouter.post('/milestones/:id/toggle', async (request, response) => {
  const { userId, timezone } = authOf(request)
  const { id } = idParam.parse(request.params)
  response.json(await projects.toggleMilestone(userId, id, today(timezone)))
})

projectsRouter.delete('/milestones/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  await projects.deleteMilestone(authOf(request).userId, id)
  response.status(204).end()
})

projectsRouter.post('/projects/:id/work-logs', async (request, response) => {
  const { userId, timezone } = authOf(request)
  const { id } = idParam.parse(request.params)
  const { day, ...input } = workLogInput.parse(request.body)
  response
    .status(201)
    .json({ workLog: await projects.addWorkLog(userId, id, { ...input, day: day ?? today(timezone) }) })
})

projectsRouter.delete('/work-logs/:id', async (request, response) => {
  const { id } = idParam.parse(request.params)
  await projects.deleteWorkLog(authOf(request).userId, id)
  response.status(204).end()
})
