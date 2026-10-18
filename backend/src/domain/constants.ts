import type { Provider, TargetCadence, TaskCategory, TaskPriority } from '../generated/prisma/enums.js'

export const CATEGORIES = ['CUSTOM', 'WATER', 'WORKOUT', 'READING'] as const satisfies readonly TaskCategory[]
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const satisfies readonly TaskPriority[]
export const CADENCES = ['DAILY', 'WEEKLY'] as const satisfies readonly TargetCadence[]
export const PROVIDERS = [
  'MANUAL',
  'LEETCODE',
  'TAKEUFORWARD',
  'DUOLINGO',
  'VELOCITYFIT',
] as const satisfies readonly Provider[]

export const XP_DAILY_CAP = 100
export const XP_WEEKLY_CAP = 400
export const TASK_XP: Record<TaskPriority, number> = {
  LOW: 8,
  MEDIUM: 10,
  HIGH: 15,
  URGENT: 20,
}
export const PERFECT_DAY_XP = 20

export const MIN_LEAD_HOURS = 1
export const MAX_LEAD_HOURS = 12
