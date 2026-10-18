import { Router } from 'express'
import { z } from 'zod'
import { localTime } from '../lib/dates.js'
import { formatDuration, minutesUntilReset } from '../lib/reminders.js'
import { HttpError } from '../lib/http.js'
import { authOf } from '../middleware/auth.js'
import * as push from '../services/pushService.js'

const subscriptionInput = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
})

export const pushRouter = Router()

pushRouter.get('/push/config', async (request, response) => {
  response.json({ ...push.pushConfig(), subscriptions: await push.countSubscriptions(authOf(request).userId) })
})

pushRouter.post('/push/subscriptions', async (request, response) => {
  await push.subscribe(authOf(request).userId, subscriptionInput.parse(request.body))
  response.status(204).end()
})

pushRouter.delete('/push/subscriptions', async (request, response) => {
  const { endpoint } = z.object({ endpoint: z.url() }).parse(request.body)
  await push.unsubscribe(authOf(request).userId, endpoint)
  response.status(204).end()
})

pushRouter.post('/push/test', async (request, response) => {
  const { userId, timezone } = authOf(request)
  const { kind } = z.object({ kind: z.enum(['reminder', 'countdown']).default('reminder') }).parse(request.body ?? {})
  const left = formatDuration(minutesUntilReset(localTime(timezone)))
  const delivered = await push.sendToUser(
    userId,
    kind === 'countdown'
      ? { title: 'Time left today', body: `${left} left. Tap to finish what is still open.`, tag: 'countdown', url: '/' }
      : { title: 'Level Up', body: 'Reminders are working. This is what your nudge looks like.', tag: 'test', url: '/' },
  )
  if (!delivered) throw new HttpError(409, 'No device is subscribed to notifications yet', 'NO_SUBSCRIPTION')
  response.json({ delivered })
})
