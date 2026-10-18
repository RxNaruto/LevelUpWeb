import cron from 'node-cron'
import { env } from '../env.js'
import { autoTrackableProviders } from '../integrations/index.js'
import { mapLimit } from '../lib/concurrency.js'
import { localTime, today } from '../lib/dates.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'
import { formatDuration, minutesUntilReset, reminderSlots } from '../lib/reminders.js'
import { pruneExpiredSessions } from '../services/authService.js'
import { sendToSubscriptions } from '../services/pushService.js'
import { syncAll } from '../services/syncService.js'
import { getDay } from '../services/taskService.js'
import { tryAcquireLease } from './lease.js'

const BATCH = 500

/** Pages through users by id so memory stays flat however many there are. */
async function forEachBatch<T extends { id: string }>(
  fetch: (cursor: string | undefined) => Promise<T[]>,
  handle: (rows: T[]) => Promise<void>,
): Promise<void> {
  let cursor: string | undefined
  for (;;) {
    const rows = await fetch(cursor)
    if (rows.length === 0) return
    await handle(rows)
    if (rows.length < BATCH) return
    cursor = rows[rows.length - 1]!.id
  }
}

export async function runSyncJob(): Promise<void> {
  let users = 0
  await forEachBatch(
    (cursor) =>
      prisma.user.findMany({
        where: { connections: { some: { enabled: true, provider: { in: autoTrackableProviders } } } },
        select: { id: true, timezone: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
    async (rows) => {
      users += rows.length
      await mapLimit(rows, 8, (user) => syncAll(user.id, today(user.timezone), user.timezone))
    },
  )
  logger.info({ users }, 'Scheduled sync finished')
}

/**
 * Runs once a minute. Each user's reminder slots are evaluated in their own
 * timezone, and because this runs on the server the nudge can name how many
 * tasks are actually still open — and stay quiet once the day is done.
 */
export async function runReminderJob(now: Date = new Date()): Promise<void> {
  let sent = 0
  await forEachBatch(
    (cursor) =>
      prisma.user.findMany({
        where: { pushSubscriptions: { some: {} }, settings: { remindersEnabled: true } },
        select: { id: true, timezone: true, settings: true, pushSubscriptions: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
    async (rows) => {
      await mapLimit(rows, 10, async (user) => {
        const settings = user.settings
        if (!settings) return
        const local = localTime(user.timezone, now)

        const isNudge = reminderSlots(settings.reminderTime, settings.reminderHourly).some(
          (slot) => slot.hour === local.hour && slot.minute === local.minute,
        )
        const isCountdown =
          settings.countdownEnabled && local.minute === 0 && local.hour === 24 - settings.countdownLeadHours
        if (!isNudge && !isCountdown) return

        const tasks = await getDay(user.id, today(user.timezone, now))
        const open = tasks.filter((task) => !task.entry.completed).length
        if (tasks.length > 0 && open === 0) return

        const left = formatDuration(minutesUntilReset(local))
        const openLine = open > 0 ? `${open} task${open === 1 ? '' : 's'} still open. ` : ''

        sent += await sendToSubscriptions(
          user.pushSubscriptions,
          isCountdown
            ? { title: 'Time left today', body: `${left} left. ${openLine}Tap to finish what is still open.`, tag: 'countdown', url: '/' }
            : { title: 'Level Up', body: `${openLine}${left} left before today resets.`, tag: 'reminder', url: '/' },
        )
      })
    },
  )
  if (sent) logger.info({ sent }, 'Reminders sent')
}

function guarded(name: string, leaseMs: number, job: () => Promise<void>) {
  return async () => {
    try {
      if (!(await tryAcquireLease(name, leaseMs))) return
      await job()
    } catch (error) {
      logger.error({ err: error, job: name }, 'Scheduled job failed')
    }
  }
}

export function startScheduler(): () => void {
  const tasks = [
    cron.schedule(env.SYNC_CRON, guarded('sync', 25 * 60_000, runSyncJob), { name: 'sync' }),
    ...(env.pushEnabled
      ? [cron.schedule('0 * * * * *', guarded('reminders', 50_000, () => runReminderJob()), { name: 'reminders' })]
      : []),
    cron.schedule(
      '17 3 * * *',
      guarded('prune-sessions', 60 * 60_000, async () => {
        logger.info({ removed: await pruneExpiredSessions() }, 'Pruned expired sessions')
      }),
      { name: 'prune-sessions' },
    ),
  ]
  logger.info({ jobs: tasks.length, push: env.pushEnabled }, 'Scheduler started')
  return () => tasks.forEach((task) => void task.stop())
}
