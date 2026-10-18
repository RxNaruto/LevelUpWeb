import { Router } from 'express'
import { z } from 'zod'
import { MAX_LEAD_HOURS, MIN_LEAD_HOURS } from '../domain/constants.js'
import { isValidTimeZone } from '../lib/dates.js'
import { timeOfDay } from '../lib/validation.js'
import { authOf } from '../middleware/auth.js'
import { getSettings, updateSettings } from '../services/settingsService.js'

const settingsPatch = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    timezone: z.string().max(64).refine(isValidTimeZone, 'Unknown timezone'),
    reminderTime: timeOfDay,
    remindersEnabled: z.boolean(),
    reminderHourly: z.boolean(),
    countdownEnabled: z.boolean(),
    countdownLeadHours: z.number().int().min(MIN_LEAD_HOURS).max(MAX_LEAD_HOURS),
  })
  .partial()

export const settingsRouter = Router()

settingsRouter.get('/settings', async (request, response) => {
  response.json({ settings: await getSettings(authOf(request).userId) })
})

settingsRouter.patch('/settings', async (request, response) => {
  const patch = settingsPatch.parse(request.body)
  response.json({ settings: await updateSettings(authOf(request).userId, patch) })
})
