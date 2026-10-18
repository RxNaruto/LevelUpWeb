import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})

export const keys = {
  today: ['today'] as const,
  tasks: ['tasks'] as const,
  task: (id: string) => ['tasks', id] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  history: (days: number) => ['history', days] as const,
  connections: ['connections'] as const,
  settings: ['settings'] as const,
  push: ['push'] as const,
}

/** Anything that changes task progress or XP can move every one of these. */
export function invalidateProgress(): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.today }),
    queryClient.invalidateQueries({ queryKey: ['history'] }),
  ]).then(() => undefined)
}
