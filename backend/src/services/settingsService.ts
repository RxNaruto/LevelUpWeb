import { prisma } from '../lib/prisma.js'

export interface ReminderSettings {
  reminderTime: string
  remindersEnabled: boolean
  reminderHourly: boolean
  countdownEnabled: boolean
  countdownLeadHours: number
}

export interface Settings extends ReminderSettings {
  displayName: string
  timezone: string
}

export const SETTINGS_DEFAULTS: ReminderSettings = {
  reminderTime: '21:00',
  remindersEnabled: true,
  reminderHourly: true,
  countdownEnabled: true,
  countdownLeadHours: 2,
}

export async function getSettings(userId: string): Promise<Settings> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, timezone: true, settings: true },
  })
  const { userId: _userId, ...stored } = user.settings ?? { userId, ...SETTINGS_DEFAULTS }
  return { ...stored, displayName: user.name, timezone: user.timezone }
}

export async function updateSettings(userId: string, patch: Partial<Settings>): Promise<Settings> {
  const { displayName, timezone, ...reminders } = patch

  await prisma.$transaction([
    prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...SETTINGS_DEFAULTS, ...reminders },
      update: reminders,
    }),
    ...(displayName?.trim() || timezone
      ? [
          prisma.user.update({
            where: { id: userId },
            data: {
              ...(displayName?.trim() ? { name: displayName.trim() } : {}),
              ...(timezone ? { timezone } : {}),
            },
          }),
        ]
      : []),
  ])

  return getSettings(userId)
}
