import type { Provider } from '../generated/prisma/enums.js'
import { connectableProviders, getIntegration, type AuthKind } from '../integrations/index.js'
import { decrypt, encrypt } from '../lib/crypto.js'
import { HttpError, notFound } from '../lib/http.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'

export interface ConnectionState {
  provider: Provider
  label: string
  authKind: AuthKind
  requires: string
  hint: string | null
  autoTrackable: boolean
  connected: boolean
  handle: string | null
  baseUrl: string | null
  /// True when an encrypted credential is stored. The credential itself is never returned.
  hasSecret: boolean
  enabled: boolean
  lastSyncedAt: string | null
  lastSyncOk: boolean
  lastSyncError: string | null
}

export interface ConnectionInput {
  handle?: string | null
  /// Empty or omitted leaves the stored credential alone.
  secret?: string | null
  baseUrl?: string | null
}

function assertConnectable(provider: Provider): void {
  if (!connectableProviders.includes(provider)) {
    throw new HttpError(400, `${getIntegration(provider).label} can't be connected`, 'NOT_CONNECTABLE')
  }
}

export async function listConnections(userId: string): Promise<ConnectionState[]> {
  const rows = await prisma.connection.findMany({ where: { userId } })
  const byProvider = new Map(rows.map((row) => [row.provider, row]))

  return connectableProviders.map((provider) => {
    const integration = getIntegration(provider)
    const row = byProvider.get(provider)
    const hasSecret = Boolean(row?.secretEncrypted)

    return {
      provider,
      label: integration.label,
      authKind: integration.authKind,
      requires: integration.requires,
      hint: integration.hint ?? null,
      autoTrackable: typeof integration.fetchActivity === 'function',
      connected: Boolean(row?.handle || hasSecret),
      handle: row?.handle ?? null,
      baseUrl: row?.baseUrl ?? null,
      hasSecret,
      enabled: row?.enabled ?? true,
      lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
      lastSyncOk: row?.lastSyncOk ?? true,
      lastSyncError: row?.lastSyncError ?? null,
    }
  })
}

export async function saveConnection(userId: string, provider: Provider, input: ConnectionInput): Promise<void> {
  assertConnectable(provider)

  const handle = input.handle?.trim() || null
  const baseUrl = input.baseUrl?.trim() || null
  const secret = input.secret?.trim()
  const secretEncrypted = secret ? encrypt(secret) : undefined

  await prisma.connection.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, handle, baseUrl, secretEncrypted: secretEncrypted ?? null },
    update: {
      handle,
      baseUrl,
      ...(secretEncrypted ? { secretEncrypted } : {}),
      lastSyncOk: true,
      lastSyncError: null,
    },
  })
}

export async function setConnectionEnabled(userId: string, provider: Provider, enabled: boolean): Promise<void> {
  const { count } = await prisma.connection.updateMany({ where: { userId, provider }, data: { enabled } })
  if (!count) throw notFound('Connection')
}

export async function removeConnection(userId: string, provider: Provider): Promise<void> {
  await prisma.connection.deleteMany({ where: { userId, provider } })
}

export async function markSync(userId: string, provider: Provider, ok: boolean, error: string | null): Promise<void> {
  await prisma.connection.updateMany({
    where: { userId, provider },
    data: { lastSyncedAt: new Date(), lastSyncOk: ok, lastSyncError: error },
  })
}

export interface ActiveConnection {
  provider: Provider
  handle: string | null
  baseUrl: string | null
  secret: string | null
}

export async function activeConnections(userId: string): Promise<ActiveConnection[]> {
  const rows = await prisma.connection.findMany({ where: { userId, enabled: true } })
  return rows.map((row) => {
    let secret: string | null = null
    if (row.secretEncrypted) {
      try {
        secret = decrypt(row.secretEncrypted)
      } catch (error) {
        // A rotated ENCRYPTION_KEY makes old credentials unreadable; the sync reports it as missing.
        logger.warn({ err: error, userId, provider: row.provider }, 'Could not decrypt connection secret')
      }
    }
    return { provider: row.provider, handle: row.handle, baseUrl: row.baseUrl, secret }
  })
}
