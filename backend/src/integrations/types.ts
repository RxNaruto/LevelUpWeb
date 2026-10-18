import type { Provider } from '../generated/prisma/enums.js'

/**
 * How a connection proves who you are. No adapter accepts a password:
 * passwords break under 2FA and bot detection and can't be revoked on their own.
 */
export type AuthKind = 'public-handle' | 'revocable-token' | 'api-key' | 'manual'

export interface ActivityQuery {
  /// Local calendar day, YYYY-MM-DD, in `timeZone`.
  day: string
  timeZone: string
  handle: string | null
  secret: string | null
  baseUrl: string | null
}

export interface ActivityResult {
  /// How many qualifying things were done on `day`.
  count: number
  /// Short human-readable evidence for the Apps screen.
  detail?: string
}

export interface Integration {
  provider: Provider
  label: string
  authKind: AuthKind
  requires: string
  hint?: string
  fetchActivity?: (query: ActivityQuery) => Promise<ActivityResult>
}

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationError'
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15_000): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new IntegrationError('The provider took too long to respond.')
    }
    throw new IntegrationError('Could not reach the provider.')
  }
}
