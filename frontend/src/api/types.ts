export type TaskCategory = 'WATER' | 'WORKOUT' | 'READING' | 'CUSTOM'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TargetCadence = 'DAILY' | 'WEEKLY'
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
export type Provider = 'MANUAL' | 'LEETCODE' | 'TAKEUFORWARD' | 'DUOLINGO' | 'VELOCITYFIT'
export type AuthKind = 'public-handle' | 'revocable-token' | 'api-key' | 'manual'

export const CATEGORIES: TaskCategory[] = ['CUSTOM', 'WATER', 'WORKOUT', 'READING']
export const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
export const CADENCES: TargetCadence[] = ['DAILY', 'WEEKLY']
export const PROVIDERS: Provider[] = ['MANUAL', 'LEETCODE', 'TAKEUFORWARD', 'DUOLINGO', 'VELOCITYFIT']

export const PROVIDER_LABELS: Record<Provider, string> = {
  MANUAL: 'Personal',
  LEETCODE: 'LeetCode',
  TAKEUFORWARD: 'takeUforward',
  DUOLINGO: 'Duolingo',
  VELOCITYFIT: 'Velocity Fit',
}

export interface LevelProgress {
  level: number
  xpTotal: number
  xpInLevel: number
  xpToNext: number
}

export interface User {
  id: string
  name: string
  email: string
  timezone: string
  xp: LevelProgress
  createdAt: string
}

export interface Task {
  id: string
  projectId: string | null
  projectName: string | null
  title: string
  description: string
  category: TaskCategory
  provider: Provider
  target: number
  unit: string
  activeDays: number[]
  priority: TaskPriority
  cadence: TargetCadence
  paused: boolean
}

export interface TaskEntry {
  progress: number
  target: number
  completed: boolean
  autoTracked: boolean
}

export interface TaskWithEntry extends Task {
  entry: TaskEntry
}

export interface XpSummary extends LevelProgress {
  todayXp: number
  dailyCap: number
  weeklyCap: number
}

export interface TodayResult {
  day: string
  streak: number
  tasks: TaskWithEntry[]
  xp: XpSummary
}

export interface ProgressResult {
  progress: number
  completed: boolean
  xpAwarded: number
}

export interface HistoryDay {
  day: string
  total: number
  completed: number
  percent: number
}

export interface TaskInput {
  title: string
  description: string
  category: TaskCategory
  provider: Provider
  target: number
  unit: string
  activeDays: number[]
  priority: TaskPriority
  cadence: TargetCadence
  projectId: string | null
}

export const EMPTY_TASK: TaskInput = {
  title: '',
  description: '',
  category: 'CUSTOM',
  provider: 'MANUAL',
  target: 1,
  unit: 'times',
  activeDays: [],
  priority: 'MEDIUM',
  cadence: 'DAILY',
  projectId: null,
}

export interface Project {
  id: string
  name: string
  description: string
  deadline: string | null
  status: ProjectStatus
  estimatedMinutes: number | null
}

export interface ProjectSummary extends Project {
  taskCount: number
  totalMinutes: number
  milestoneCount: number
  milestonesDone: number
}

export interface ProjectMilestone {
  id: string
  title: string
  weight: number
  dueDate: string | null
  done: boolean
}

export interface ProjectWorkLog {
  id: string
  durationMinutes: number
  day: string
  note: string
}

export interface ProjectDetail extends Project {
  milestones: ProjectMilestone[]
  workLogs: ProjectWorkLog[]
  totalMinutes: number
  taskCount: number
}

export interface ProjectInput {
  name: string
  description: string
  deadline: string | null
  estimatedMinutes: number | null
}

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
  hasSecret: boolean
  enabled: boolean
  lastSyncedAt: string | null
  lastSyncOk: boolean
  lastSyncError: string | null
}

export type SyncStatus = 'updated' | 'unchanged' | 'skipped' | 'failed'

export interface SyncOutcome {
  provider: Provider
  label: string
  status: SyncStatus
  message: string
}

export interface Settings {
  displayName: string
  timezone: string
  reminderTime: string
  remindersEnabled: boolean
  reminderHourly: boolean
  countdownEnabled: boolean
  countdownLeadHours: number
}

export interface PushConfig {
  enabled: boolean
  publicKey: string | null
  subscriptions: number
}
