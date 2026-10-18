import webpush from 'web-push'
import { env } from '../env.js'
import { mapLimit } from '../lib/concurrency.js'
import { HttpError } from '../lib/http.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'

if (env.pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)
}

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

export interface PushSubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function pushConfig(): { enabled: boolean; publicKey: string | null } {
  return { enabled: env.pushEnabled, publicKey: env.pushEnabled ? env.VAPID_PUBLIC_KEY! : null }
}

export async function subscribe(userId: string, input: PushSubscriptionInput): Promise<void> {
  if (!env.pushEnabled) throw new HttpError(503, 'Push notifications are not configured on this server', 'PUSH_DISABLED')
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { userId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth },
    update: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth },
  })
}

export async function unsubscribe(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
}

export async function countSubscriptions(userId: string): Promise<number> {
  return prisma.pushSubscription.count({ where: { userId } })
}

/** Sends to every device of a user. Subscriptions the push service reports gone are deleted. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!env.pushEnabled) return 0
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  return sendToSubscriptions(subscriptions, payload)
}

export async function sendToSubscriptions(
  subscriptions: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
): Promise<number> {
  if (!env.pushEnabled || subscriptions.length === 0) return 0
  const body = JSON.stringify(payload)
  const stale: string[] = []

  const results = await mapLimit(subscriptions, 10, async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        body,
        { TTL: 60 * 60, urgency: 'high' },
      )
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) stale.push(subscription.id)
      else logger.warn({ err: error, status }, 'Push delivery failed')
      throw error
    }
  })

  if (stale.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } })
  return results.filter((result) => result.status === 'fulfilled').length
}
