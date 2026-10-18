import bcrypt from 'bcryptjs'
import { env } from '../env.js'
import { decrypt, encrypt, randomToken, sha256 } from '../lib/crypto.js'
import { HttpError } from '../lib/http.js'
import { prisma } from '../lib/prisma.js'
import { signAccessToken } from '../middleware/auth.js'
import { SETTINGS_DEFAULTS } from './settingsService.js'
import { levelProgress, type LevelProgress } from './xpService.js'

const BCRYPT_ROUNDS = 12
const DAY_MS = 24 * 60 * 60 * 1000

/// Compared against when the email is unknown, so a miss costs the same time as a hit.
const DUMMY_HASH = bcrypt.hashSync('levelup-timing-equaliser', BCRYPT_ROUNDS)

export interface PublicUser {
  id: string
  name: string
  email: string
  timezone: string
  xp: LevelProgress
  createdAt: string
}

export interface AuthResult {
  user: PublicUser
  accessToken: string
  refreshToken: string
  refreshExpiresAt: Date
}

function toPublicUser(user: {
  id: string
  name: string
  email: string
  timezone: string
  xpTotal: number
  createdAt: Date
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    xp: levelProgress(user.xpTotal),
    createdAt: user.createdAt.toISOString(),
  }
}

async function startSession(
  user: Parameters<typeof toPublicUser>[0],
  userAgent: string | undefined,
): Promise<AuthResult> {
  const refreshToken = randomToken()
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * DAY_MS)
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: userAgent?.slice(0, 255),
      expiresAt: refreshExpiresAt,
    },
  })
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user.id, session.id, user.timezone),
    refreshToken,
    refreshExpiresAt,
  }
}

export async function register(
  input: { name: string; email: string; password: string; timezone: string },
  userAgent?: string,
): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })
  if (existing) throw new HttpError(409, 'An account with that email already exists', 'EMAIL_TAKEN')

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      timezone: input.timezone,
      settings: { create: SETTINGS_DEFAULTS },
    },
  })
  return startSession(user, userAgent)
}

export async function login(
  input: { email: string; password: string; timezone?: string },
  userAgent?: string,
): Promise<AuthResult> {
  let user = await prisma.user.findUnique({ where: { email: input.email } })
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !valid) throw new HttpError(401, 'Invalid email or password', 'BAD_CREDENTIALS')

  if (input.timezone && input.timezone !== user.timezone) {
    user = await prisma.user.update({ where: { id: user.id }, data: { timezone: input.timezone } })
  }
  return startSession(user, userAgent)
}

/** Rotates the refresh token: the presented one is consumed and a new one issued. */
/** How long a just-replaced refresh token keeps working. */
const ROTATION_GRACE_MS = 60_000

export async function refresh(refreshToken: string, userAgent?: string): Promise<AuthResult> {
  const presented = sha256(refreshToken)

  // A second attempt covers a concurrent refresh that rotated the token between our read and write.
  for (let attempt = 0; attempt < 2; attempt++) {
    const session = await prisma.session.findFirst({
      where: {
        OR: [
          { tokenHash: presented },
          { previousTokenHash: presented, rotatedAt: { gt: new Date(Date.now() - ROTATION_GRACE_MS) } },
        ],
      },
      include: { user: true },
    })

    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
      break
    }

    // The client never saw the latest rotation (lost response, or another tab won the race).
    // Hand back the same current token, so any number of retries converge on one token.
    if (session.tokenHash !== presented) {
      if (!session.tokenCipher) break
      await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      return {
        user: toPublicUser(session.user),
        accessToken: signAccessToken(session.user.id, session.id, session.user.timezone),
        refreshToken: decrypt(session.tokenCipher),
        refreshExpiresAt: session.expiresAt,
      }
    }

    const next = randomToken()
    const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * DAY_MS)

    // Conditional on the hash we read, so two refreshes can't both rotate from the same state;
    // the loser goes round again and takes the branch above.
    const { count } = await prisma.session.updateMany({
      where: { id: session.id, tokenHash: presented },
      data: {
        tokenHash: sha256(next),
        tokenCipher: encrypt(next),
        previousTokenHash: presented,
        rotatedAt: new Date(),
        expiresAt: refreshExpiresAt,
        lastUsedAt: new Date(),
        ...(userAgent ? { userAgent: userAgent.slice(0, 255) } : {}),
      },
    })
    if (!count) continue

    return {
      user: toPublicUser(session.user),
      accessToken: signAccessToken(session.user.id, session.id, session.user.timezone),
      refreshToken: next,
      refreshExpiresAt,
    }
  }

  throw new HttpError(401, 'Session expired. Sign in again.', 'SESSION_EXPIRED')
}

export async function logout(refreshToken: string | undefined, sessionId?: string): Promise<void> {
  if (refreshToken) {
    const hash = sha256(refreshToken)
    await prisma.session.deleteMany({ where: { OR: [{ tokenHash: hash }, { previousTokenHash: hash }] } })
  } else if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } })
  }
}

export async function logoutEverywhere(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

export async function me(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new HttpError(401, 'Account no longer exists', 'UNAUTHENTICATED')
  return toPublicUser(user)
}

export async function changePassword(
  userId: string,
  sessionId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect', 'BAD_CREDENTIALS')
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    }),
    // Every other device has to sign in again with the new password.
    prisma.session.deleteMany({ where: { userId, id: { not: sessionId } } }),
  ])
}

export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(400, 'Password is incorrect', 'BAD_CREDENTIALS')
  }
  await prisma.user.delete({ where: { id: userId } })
}

export async function pruneExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  return count
}
