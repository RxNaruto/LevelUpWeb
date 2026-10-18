import type { User } from './types'

const BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface AuthPayload {
  user: User
  accessToken: string
}

export const browserTimeZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
})()

let accessToken: string | null = null
let refreshInFlight: Promise<AuthPayload | null> | null = null
const listeners = new Set<(payload: AuthPayload | null) => void>()

/** Notified whenever the session changes underneath the UI — a refresh, or a forced sign-out. */
export function onSessionChange(listener: (payload: AuthPayload | null) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setSession(payload: AuthPayload | null): void {
  accessToken = payload?.accessToken ?? null
  listeners.forEach((listener) => listener(payload))
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('X-Timezone', browserTimeZone)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  try {
    return await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection.', 'NETWORK')
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as { error?: string } | null)?.error ?? `Request failed (${response.status})`,
      (body as { code?: string } | null)?.code,
    )
  }
  return body as T
}

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Tabs share
 * that cookie and every refresh rotates it, so the exchange is serialised
 * across tabs with a Web Lock — otherwise two tabs could present the same
 * token and the loser would be signed out.
 */
export function refreshSession(): Promise<AuthPayload | null> {
  refreshInFlight ??= (async () => {
    const run = async () => {
      const response = await send('/auth/refresh', { method: 'POST', body: '{}' })
      if (!response.ok) return null
      return (await response.json()) as AuthPayload
    }
    try {
      const payload = navigator.locks ? await navigator.locks.request('levelup-refresh', run) : await run()
      setSession(payload)
      return payload
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }

  let response = await send(path, init)

  if (response.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession()
    if (!refreshed) throw new ApiError(401, 'Your session expired. Sign in again.', 'SESSION_EXPIRED')
    response = await send(path, init)
  }

  return parse<T>(response)
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}
