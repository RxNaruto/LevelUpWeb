import { api, browserTimeZone, type AuthPayload } from './client'
import type {
  ConnectionState,
  HistoryDay,
  Project,
  ProjectDetail,
  ProjectInput,
  ProjectMilestone,
  ProjectStatus,
  ProjectSummary,
  ProjectWorkLog,
  ProgressResult,
  Provider,
  PushConfig,
  Settings,
  SyncOutcome,
  Task,
  TaskInput,
  TodayResult,
  User,
} from './types'

export const authApi = {
  login: (email: string, password: string) =>
    api<AuthPayload>('/auth/login', { method: 'POST', body: { email, password, timezone: browserTimeZone } }),
  register: (name: string, email: string, password: string) =>
    api<AuthPayload>('/auth/register', { method: 'POST', body: { name, email, password, timezone: browserTimeZone } }),
  logout: () => api<void>('/auth/logout', { method: 'POST', body: {} }),
  logoutAll: () => api<void>('/auth/logout-all', { method: 'POST', body: {} }),
  me: () => api<{ user: User }>('/auth/me').then((result) => result.user),
}

export const tasksApi = {
  today: () => api<TodayResult>('/today'),
  history: (days: number) => api<{ days: HistoryDay[]; streak: number }>(`/history?days=${days}`),
  list: () => api<{ tasks: Task[] }>('/tasks').then((result) => result.tasks),
  get: (id: string) => api<{ task: Task }>(`/tasks/${id}`).then((result) => result.task),
  create: (input: TaskInput) =>
    api<{ task: Task }>('/tasks', { method: 'POST', body: input }).then((result) => result.task),
  update: (id: string, input: TaskInput) =>
    api<{ task: Task }>(`/tasks/${id}`, { method: 'PUT', body: input }).then((result) => result.task),
  setPaused: (id: string, paused: boolean) =>
    api<{ task: Task }>(`/tasks/${id}/pause`, { method: 'POST', body: { paused } }),
  archive: (id: string) => api<void>(`/tasks/${id}`, { method: 'DELETE' }),
  toggle: (id: string) => api<ProgressResult>(`/tasks/${id}/toggle`, { method: 'POST', body: {} }),
  setProgress: (id: string, progress: number) =>
    api<ProgressResult>(`/tasks/${id}/progress`, { method: 'PUT', body: { progress } }),
}

export const projectsApi = {
  list: () => api<{ projects: ProjectSummary[] }>('/projects').then((result) => result.projects),
  get: (id: string) => api<{ project: ProjectDetail }>(`/projects/${id}`).then((result) => result.project),
  create: (input: ProjectInput) =>
    api<{ project: Project }>('/projects', { method: 'POST', body: input }).then((result) => result.project),
  update: (id: string, patch: Partial<ProjectInput> & { status?: ProjectStatus }) =>
    api<{ project: Project }>(`/projects/${id}`, { method: 'PATCH', body: patch }).then((result) => result.project),
  remove: (id: string) => api<void>(`/projects/${id}`, { method: 'DELETE' }),
  addMilestone: (projectId: string, input: { title: string; weight: number; dueDate: string | null }) =>
    api<{ milestone: ProjectMilestone }>(`/projects/${projectId}/milestones`, { method: 'POST', body: input }),
  toggleMilestone: (id: string) =>
    api<{ done: boolean; xpAwarded: number }>(`/milestones/${id}/toggle`, { method: 'POST', body: {} }),
  deleteMilestone: (id: string) => api<void>(`/milestones/${id}`, { method: 'DELETE' }),
  addWorkLog: (projectId: string, input: { durationMinutes: number; note: string }) =>
    api<{ workLog: ProjectWorkLog }>(`/projects/${projectId}/work-logs`, { method: 'POST', body: input }),
  deleteWorkLog: (id: string) => api<void>(`/work-logs/${id}`, { method: 'DELETE' }),
}

export const connectionsApi = {
  list: () => api<{ connections: ConnectionState[] }>('/connections').then((result) => result.connections),
  save: (provider: Provider, input: { handle?: string | null; secret?: string | null; baseUrl?: string | null }) =>
    api<{ connections: ConnectionState[] }>(`/connections/${provider}`, { method: 'PUT', body: input }),
  setEnabled: (provider: Provider, enabled: boolean) =>
    api<{ connections: ConnectionState[] }>(`/connections/${provider}`, { method: 'PATCH', body: { enabled } }),
  remove: (provider: Provider) =>
    api<{ connections: ConnectionState[] }>(`/connections/${provider}`, { method: 'DELETE' }),
  sync: () => api<{ outcomes: SyncOutcome[] }>('/sync', { method: 'POST', body: {} }).then((result) => result.outcomes),
}

export const settingsApi = {
  get: () => api<{ settings: Settings }>('/settings').then((result) => result.settings),
  update: (patch: Partial<Settings>) =>
    api<{ settings: Settings }>('/settings', { method: 'PATCH', body: patch }).then((result) => result.settings),
}

export const pushApi = {
  config: () => api<PushConfig>('/push/config'),
  subscribe: (subscription: PushSubscriptionJSON) =>
    api<void>('/push/subscriptions', { method: 'POST', body: subscription }),
  unsubscribe: (endpoint: string) => api<void>('/push/subscriptions', { method: 'DELETE', body: { endpoint } }),
  test: (kind: 'reminder' | 'countdown') =>
    api<{ delivered: number }>('/push/test', { method: 'POST', body: { kind } }),
}
