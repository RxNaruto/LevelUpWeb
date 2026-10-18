import type { TaskPriority, XpSource } from '../generated/prisma/enums.js'
import { PERFECT_DAY_XP, TASK_XP, XP_DAILY_CAP, XP_WEEKLY_CAP } from '../domain/constants.js'
import { cappedXp, levelForXp, levelProgress, type LevelProgress } from '../domain/xp.js'
import { weekKey } from '../lib/dates.js'
import { prisma } from '../lib/prisma.js'

export { levelProgress, type LevelProgress }

export interface XpSummary extends LevelProgress {
  todayXp: number
  dailyCap: number
  weeklyCap: number
}

/**
 * Awards XP at most once per idempotency key, capped per day and per ISO week.
 * The user row is locked first, so concurrent awards serialise on the caps
 * instead of both reading the same remaining allowance.
 */
async function award(
  userId: string,
  source: XpSource,
  sourceId: string,
  day: string,
  requested: number,
): Promise<number> {
  const periodKey = weekKey(day)
  const idempotencyKey = `${userId}:${source}:${sourceId}:${day}`

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`

    const existing = await tx.xpEvent.findUnique({ where: { idempotencyKey }, select: { id: true } })
    if (existing) return 0

    const [daily, weekly] = await Promise.all([
      tx.xpEvent.aggregate({ where: { userId, day }, _sum: { xp: true } }),
      tx.xpEvent.aggregate({ where: { userId, periodKey }, _sum: { xp: true } }),
    ])

    const xp = cappedXp(requested, daily._sum.xp ?? 0, weekly._sum.xp ?? 0)
    if (!xp) return 0

    await tx.xpEvent.create({
      data: { userId, source, sourceId, periodKey, day, xp, idempotencyKey },
    })
    const user = await tx.user.update({
      where: { id: userId },
      data: { xpTotal: { increment: xp } },
      select: { xpTotal: true },
    })
    await tx.user.update({ where: { id: userId }, data: { level: levelForXp(user.xpTotal) } })

    return xp
  })
}

export function awardTaskXp(
  userId: string,
  taskId: string,
  priority: TaskPriority,
  periodKey: string,
  day: string,
): Promise<number> {
  return award(userId, 'TASK_COMPLETE', `${taskId}:${periodKey}`, day, TASK_XP[priority])
}

export function awardMilestoneXp(userId: string, milestoneId: string, weight: number, day: string): Promise<number> {
  return award(userId, 'MILESTONE_COMPLETE', milestoneId, day, Math.min(100, 25 * weight))
}

export function awardPerfectDayXp(userId: string, day: string): Promise<number> {
  return award(userId, 'PERFECT_DAY', day, day, PERFECT_DAY_XP)
}

export async function getXpSummary(userId: string, day: string): Promise<XpSummary> {
  const [user, todayXp] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xpTotal: true } }),
    prisma.xpEvent.aggregate({ where: { userId, day }, _sum: { xp: true } }),
  ])

  return {
    ...levelProgress(user?.xpTotal ?? 0),
    todayXp: todayXp._sum.xp ?? 0,
    dailyCap: XP_DAILY_CAP,
    weeklyCap: XP_WEEKLY_CAP,
  }
}
