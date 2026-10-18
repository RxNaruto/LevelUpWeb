import { today } from '../lib/dates.js'
import { fetchWithTimeout, IntegrationError, type Integration } from './types.js'

interface XpSummary {
  date: number
  gainedXp: number | null
}

/**
 * Duolingo has no supported public API. These are the endpoints its own web
 * client calls, so they can change without notice; a failed sync degrades to
 * manual check-off rather than breaking the goal.
 */
export const duolingo: Integration = {
  provider: 'DUOLINGO',
  label: 'Duolingo',
  authKind: 'revocable-token',
  requires: 'Your Duolingo username and jwt_token cookie',
  hint: 'Log in to duolingo.com on a computer, open DevTools, then Application → Cookies → jwt_token. Logging out revokes it.',
  async fetchActivity({ day, timeZone, handle, secret }) {
    if (!handle) throw new IntegrationError('A Duolingo username is required')
    if (!secret) throw new IntegrationError('A Duolingo jwt_token is required')

    const headers = { Authorization: `Bearer ${secret}`, 'User-Agent': 'LevelUp/1.0' }

    const profile = await fetchWithTimeout(
      `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(handle)}`,
      { headers },
    )

    if (profile.status === 401 || profile.status === 403) {
      throw new IntegrationError('Duolingo token expired. Paste a fresh jwt_token.')
    }
    if (!profile.ok) throw new IntegrationError(`Duolingo responded with ${profile.status}`)

    const users = ((await profile.json()) as { users?: { id: number }[] }).users
    const userId = users?.[0]?.id
    if (!userId) throw new IntegrationError(`No Duolingo user found for "${handle}"`)

    const summary = await fetchWithTimeout(
      `https://www.duolingo.com/2017-06-30/users/${userId}/xp_summaries?startDate=${day}`,
      { headers },
    )
    if (!summary.ok) throw new IntegrationError(`Duolingo XP lookup failed with ${summary.status}`)

    const summaries = ((await summary.json()) as { summaries?: XpSummary[] }).summaries ?? []
    const match = summaries.find((entry) => today(timeZone, new Date(entry.date * 1000)) === day)
    const xp = match?.gainedXp ?? 0

    // Any XP at all means a lesson was completed, which is what keeps a streak.
    return { count: xp > 0 ? 1 : 0, detail: xp > 0 ? `${xp} XP earned` : undefined }
  },
}
