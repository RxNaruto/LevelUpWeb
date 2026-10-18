import { z } from 'zod'

export const id = z.string().min(1).max(64)
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM, 24-hour')

export const idParam = z.object({ id })
