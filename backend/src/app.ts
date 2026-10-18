import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Router } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { env } from './env.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'
import { requireAuth } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { authRouter } from './routes/auth.js'
import { connectionsRouter } from './routes/connections.js'
import { projectsRouter } from './routes/projects.js'
import { pushRouter } from './routes/push.js'
import { settingsRouter } from './routes/settings.js'
import { tasksRouter } from './routes/tasks.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY)
  app.set('etag', false)

  app.use(helmet())
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Timezone', 'X-Client'],
      maxAge: 86_400,
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (request) => request.url === '/healthz' },
      customLogLevel: (_request, response, error) =>
        error || response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info',
    }),
  )

  app.get('/healthz', (_request, response) => {
    response.json({ ok: true })
  })

  const api = Router()

  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many requests. Slow down a little.', code: 'RATE_LIMITED' },
    }),
  )

  // No caching anywhere under /api: every response is per-user.
  api.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })

  api.get('/health', async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`
    response.json({ ok: true, database: 'up' })
  })

  api.use('/auth', authRouter)

  const authed = Router()
  authed.use(requireAuth)
  authed.use(tasksRouter, projectsRouter, connectionsRouter, settingsRouter, pushRouter)
  api.use(authed)

  app.use('/api', api)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
