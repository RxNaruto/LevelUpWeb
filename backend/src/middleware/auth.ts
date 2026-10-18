import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'
import { isValidTimeZone } from '../lib/dates.js'
import { HttpError } from '../lib/http.js'

interface AccessClaims {
  sub: string
  sid: string
  tz: string
}

export function signAccessToken(userId: string, sessionId: string, timezone: string): string {
  return jwt.sign({ sid: sessionId, tz: timezone } satisfies Omit<AccessClaims, 'sub'>, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  })
}

/** Stateless: verifies the signature only, so authenticated requests cost no query. */
export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HttpError(401, 'Sign in to continue', 'UNAUTHENTICATED')

  let claims: AccessClaims
  try {
    claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as AccessClaims
  } catch (error) {
    const expired = error instanceof jwt.TokenExpiredError
    throw new HttpError(401, expired ? 'Session expired' : 'Invalid token', expired ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED')
  }

  const headerZone = request.header('x-timezone')
  request.auth = {
    userId: claims.sub,
    sessionId: claims.sid,
    timezone: headerZone && isValidTimeZone(headerZone) ? headerZone : claims.tz || 'UTC',
  }
  next()
}

export function authOf(request: Request): NonNullable<Request['auth']> {
  if (!request.auth) throw new HttpError(401, 'Sign in to continue', 'UNAUTHENTICATED')
  return request.auth
}
