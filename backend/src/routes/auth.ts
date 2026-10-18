import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../env.js'
import { isValidTimeZone } from '../lib/dates.js'
import { HttpError } from '../lib/http.js'
import { authOf, requireAuth } from '../middleware/auth.js'
import * as auth from '../services/authService.js'

const REFRESH_COOKIE = 'lu_refresh'

const email = z.email('Enter a valid email address').trim().toLowerCase().max(254)
const password = z.string().min(8, 'Password must be at least 8 characters').max(128)
const timezone = z.string().max(64).refine(isValidTimeZone, 'Unknown timezone')

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(60),
  email,
  password,
  timezone: timezone.default('UTC'),
})
const loginSchema = z.object({ email, password: z.string().min(1).max(128), timezone: timezone.optional() })
const refreshSchema = z.object({ refreshToken: z.string().min(20).optional() }).default({})

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.', code: 'RATE_LIMITED' },
})

/**
 * Browsers get the refresh token only as an httpOnly cookie, out of reach of
 * page scripts. Native clients have no cookie jar worth trusting, so they ask
 * for it in the body with `X-Client: mobile` and keep it in secure storage.
 */
function isNativeClient(request: Request): boolean {
  return request.header('x-client') === 'mobile'
}

function sendAuth(request: Request, response: Response, result: auth.AuthResult, status = 200): void {
  const native = isNativeClient(request)
  if (!native) {
    response.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: env.COOKIE_SAMESITE,
      path: '/api/auth',
      expires: result.refreshExpiresAt,
    })
  }
  response.status(status).json({
    user: result.user,
    accessToken: result.accessToken,
    ...(native ? { refreshToken: result.refreshToken, refreshExpiresAt: result.refreshExpiresAt.toISOString() } : {}),
  })
}

function clearAuthCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.COOKIE_SAMESITE,
    path: '/api/auth',
  })
}

function presentedRefreshToken(request: Request): string | undefined {
  const body = refreshSchema.parse(request.body ?? {})
  return body.refreshToken ?? (request.cookies?.[REFRESH_COOKIE] as string | undefined)
}

export const authRouter = Router()

authRouter.post('/register', authLimiter, async (request, response) => {
  const input = registerSchema.parse(request.body)
  sendAuth(request, response, await auth.register(input, request.header('user-agent')), 201)
})

authRouter.post('/login', authLimiter, async (request, response) => {
  const input = loginSchema.parse(request.body)
  sendAuth(request, response, await auth.login(input, request.header('user-agent')))
})

authRouter.post('/refresh', async (request, response) => {
  const token = presentedRefreshToken(request)
  if (!token) throw new HttpError(401, 'Sign in to continue', 'UNAUTHENTICATED')
  try {
    sendAuth(request, response, await auth.refresh(token, request.header('user-agent')))
  } catch (error) {
    clearAuthCookie(response)
    throw error
  }
})

authRouter.post('/logout', async (request, response) => {
  await auth.logout(presentedRefreshToken(request))
  clearAuthCookie(response)
  response.status(204).end()
})

authRouter.post('/logout-all', requireAuth, async (request, response) => {
  await auth.logoutEverywhere(authOf(request).userId)
  clearAuthCookie(response)
  response.status(204).end()
})

authRouter.get('/me', requireAuth, async (request, response) => {
  response.json({ user: await auth.me(authOf(request).userId) })
})

authRouter.post('/change-password', requireAuth, authLimiter, async (request, response) => {
  const input = z.object({ currentPassword: z.string().min(1), newPassword: password }).parse(request.body)
  const { userId, sessionId } = authOf(request)
  await auth.changePassword(userId, sessionId, input.currentPassword, input.newPassword)
  response.status(204).end()
})

authRouter.delete('/account', requireAuth, authLimiter, async (request, response) => {
  const input = z.object({ password: z.string().min(1) }).parse(request.body)
  await auth.deleteAccount(authOf(request).userId, input.password)
  clearAuthCookie(response)
  response.status(204).end()
})
