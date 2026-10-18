import { createContext, useContext } from 'react'
import type { User } from '@/api/types'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export interface AuthValue {
  status: AuthStatus
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: (everywhere?: boolean) => Promise<void>
  updateUser: (patch: Partial<User>) => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
