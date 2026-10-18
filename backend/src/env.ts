import { z } from 'zod'

const hexKey = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'must be 32 bytes encoded as 64 hex characters')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  ENCRYPTION_KEY: hexKey,
  /// Comma-separated list of origins allowed to call the API from a browser.
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  /// `none` when the frontend and API live on different sites.
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /// Turn off on API replicas when a dedicated worker runs the jobs.
  RUN_JOBS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  SYNC_CRON: z.string().default('*/30 * * * *'),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@levelup.local'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  console.error(`Invalid environment configuration:\n${issues}`)
  process.exit(1)
}

const values = parsed.data

export const env = {
  ...values,
  isProduction: values.NODE_ENV === 'production',
  corsOrigins: values.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  cookieSecure: values.COOKIE_SECURE ?? values.NODE_ENV === 'production',
  pushEnabled: Boolean(values.VAPID_PUBLIC_KEY && values.VAPID_PRIVATE_KEY),
}
