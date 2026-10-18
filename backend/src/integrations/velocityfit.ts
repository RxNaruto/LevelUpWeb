import { fetchWithTimeout, IntegrationError, type Integration } from './types.js'

const DEFAULT_BASE_URL = 'https://velocity-fit-gamma.vercel.app'

/**
 * Velocity Fit is a first-party app, so it uses a proper API key. It expects an
 * endpoint reporting whether a workout was logged on a given day; until that
 * exists the sync fails softly and the goal stays manual.
 */
export const velocityfit: Integration = {
  provider: 'VELOCITYFIT',
  label: 'Velocity Fit',
  authKind: 'api-key',
  requires: 'An API key issued by your Velocity Fit backend',
  hint: 'Needs a /api/activity/daily endpoint on Velocity Fit. Until that ships, tick these off manually.',
  async fetchActivity({ day, secret, baseUrl }) {
    if (!secret) throw new IntegrationError('A Velocity Fit API key is required')

    const root = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
    const response = await fetchWithTimeout(`${root}/api/activity/daily?date=${day}`, {
      headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
    })

    if (response.status === 401 || response.status === 403) {
      throw new IntegrationError('Velocity Fit rejected the API key')
    }
    if (response.status === 404) {
      throw new IntegrationError('Velocity Fit has no /api/activity/daily endpoint yet')
    }
    if (!response.ok) throw new IntegrationError(`Velocity Fit responded with ${response.status}`)

    const body = (await response.json()) as { workouts?: number; completed?: boolean; detail?: string }
    return { count: body.workouts ?? (body.completed ? 1 : 0), detail: body.detail }
  },
}
