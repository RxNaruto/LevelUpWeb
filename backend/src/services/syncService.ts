import type { Provider } from '../generated/prisma/enums.js'
import { getIntegration } from '../integrations/index.js'
import { activeConnections, markSync } from './connectionService.js'
import { getDay, setProgress } from './taskService.js'

export type SyncStatus = 'updated' | 'unchanged' | 'skipped' | 'failed'

export interface SyncOutcome {
  provider: Provider
  label: string
  status: SyncStatus
  message: string
}

/**
 * Pulls today's activity from every enabled connection and raises matching
 * task progress. Progress is only ever raised, so ticking something off by
 * hand always wins over a sync.
 */
export async function syncAll(userId: string, day: string, timeZone: string): Promise<SyncOutcome[]> {
  const [tasks, connections] = await Promise.all([getDay(userId, day), activeConnections(userId)])

  return Promise.all(
    connections.map(async (connection): Promise<SyncOutcome> => {
      const integration = getIntegration(connection.provider)
      const relevant = tasks.filter((task) => task.provider === connection.provider)
      const base = { provider: connection.provider, label: integration.label }

      if (!integration.fetchActivity) {
        return { ...base, status: 'skipped', message: `${integration.label} is tracked manually` }
      }
      if (relevant.length === 0) {
        return { ...base, status: 'skipped', message: `No ${integration.label} tasks today` }
      }

      try {
        const result = await integration.fetchActivity({
          day,
          timeZone,
          handle: connection.handle,
          secret: connection.secret,
          baseUrl: connection.baseUrl,
        })

        let changed = false
        for (const task of relevant) {
          if (result.count > task.entry.progress) {
            await setProgress(userId, task.id, day, result.count, { autoTracked: true })
            changed = true
          }
        }

        await markSync(userId, connection.provider, true, null)
        return {
          ...base,
          status: changed ? 'updated' : 'unchanged',
          message: result.detail ?? `${result.count} tracked today`,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error'
        await markSync(userId, connection.provider, false, message)
        return { ...base, status: 'failed', message }
      }
    }),
  )
}
