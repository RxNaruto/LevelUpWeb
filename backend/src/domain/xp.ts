import { XP_DAILY_CAP, XP_WEEKLY_CAP } from './constants.js'

export interface LevelProgress {
  level: number
  xpTotal: number
  xpInLevel: number
  xpToNext: number
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp)
  const currentFloor = (level - 1) ** 2 * 100
  const nextFloor = level ** 2 * 100
  return { level, xpTotal: xp, xpInLevel: xp - currentFloor, xpToNext: nextFloor - currentFloor }
}

/** Clamps a request to whatever room is left under the daily and weekly caps. */
export function cappedXp(requested: number, earnedToday: number, earnedThisWeek: number): number {
  return Math.max(0, Math.min(requested, XP_DAILY_CAP - earnedToday, XP_WEEKLY_CAP - earnedThisWeek))
}
