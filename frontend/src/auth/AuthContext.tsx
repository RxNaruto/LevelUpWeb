import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { browserTimeZone, onSessionChange, refreshSession, setSession, type AuthPayload } from '@/api/client'
import { authApi, settingsApi } from '@/api/endpoints'
import { queryClient } from '@/api/queryClient'
import type { User } from '@/api/types'
import { AuthContext, type AuthStatus } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const unsubscribe = onSessionChange((payload) => {
      setUser(payload?.user ?? null)
      setStatus(payload ? 'authenticated' : 'anonymous')
      if (!payload) queryClient.clear()
    })
    void refreshSession()
    return () => {
      unsubscribe()
    }
  }, [])

  // Scheduled reminders run on the server in the account's timezone, so keep
  // it in step with wherever the browser currently is.
  useEffect(() => {
    if (user && user.timezone !== browserTimeZone) {
      void settingsApi.update({ timezone: browserTimeZone }).then(() =>
        setUser((current) => (current ? { ...current, timezone: browserTimeZone } : current)),
      ).catch(() => undefined)
    }
  }, [user])

  const accept = useCallback((payload: AuthPayload) => {
    queryClient.clear()
    setSession(payload)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => accept(await authApi.login(email, password)),
    [accept],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => accept(await authApi.register(name, email, password)),
    [accept],
  )

  const logout = useCallback(async (everywhere = false) => {
    try {
      await (everywhere ? authApi.logoutAll() : authApi.logout())
    } finally {
      setSession(null)
    }
  }, [])

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const value = useMemo(
    () => ({ status, user, login, register, logout, updateUser }),
    [status, user, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
