import 'dotenv/config'
import { createApp } from './app.js'
import { env } from './env.js'
import { startScheduler } from './jobs/scheduler.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'

const app = createApp()
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'LevelUp API listening')
})

// Longer than a typical load balancer idle timeout, so keep-alive sockets aren't cut mid-request.
server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000

const stopScheduler = env.RUN_JOBS ? startScheduler() : () => undefined

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'Shutting down')

  stopScheduler()
  const forced = setTimeout(() => {
    logger.error('Forced exit after shutdown timeout')
    process.exit(1)
  }, 10_000)
  forced.unref()

  server.close(async () => {
    await prisma.$disconnect()
    logger.info('Shutdown complete')
    process.exit(0)
  })
  server.closeIdleConnections()
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection')
})
