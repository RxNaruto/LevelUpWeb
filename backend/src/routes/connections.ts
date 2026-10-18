import { Router } from 'express'
import { z } from 'zod'
import { PROVIDERS } from '../domain/constants.js'
import { today } from '../lib/dates.js'
import { authOf } from '../middleware/auth.js'
import * as connections from '../services/connectionService.js'
import { syncAll } from '../services/syncService.js'

const providerParam = z.object({ provider: z.enum(PROVIDERS) })
const connectionInput = z.object({
  handle: z.string().trim().max(100).nullable().optional(),
  secret: z.string().trim().max(4096).nullable().optional(),
  baseUrl: z.url().max(300).nullable().optional().or(z.literal('')),
})

export const connectionsRouter = Router()

connectionsRouter.get('/connections', async (request, response) => {
  response.json({ connections: await connections.listConnections(authOf(request).userId) })
})

connectionsRouter.put('/connections/:provider', async (request, response) => {
  const { userId } = authOf(request)
  const { provider } = providerParam.parse(request.params)
  await connections.saveConnection(userId, provider, connectionInput.parse(request.body))
  response.json({ connections: await connections.listConnections(userId) })
})

connectionsRouter.patch('/connections/:provider', async (request, response) => {
  const { userId } = authOf(request)
  const { provider } = providerParam.parse(request.params)
  const { enabled } = z.object({ enabled: z.boolean() }).parse(request.body)
  await connections.setConnectionEnabled(userId, provider, enabled)
  response.json({ connections: await connections.listConnections(userId) })
})

connectionsRouter.delete('/connections/:provider', async (request, response) => {
  const { userId } = authOf(request)
  const { provider } = providerParam.parse(request.params)
  await connections.removeConnection(userId, provider)
  response.json({ connections: await connections.listConnections(userId) })
})

connectionsRouter.post('/sync', async (request, response) => {
  const { userId, timezone } = authOf(request)
  response.json({ outcomes: await syncAll(userId, today(timezone), timezone) })
})
