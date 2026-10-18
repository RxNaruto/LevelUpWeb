import { today } from '../lib/dates.js'
import { fetchWithTimeout, IntegrationError, type Integration } from './types.js'

const ENDPOINT = 'https://leetcode.com/graphql'

/// The API caps this query at 20 regardless of what is asked for.
const MAX_LIMIT = 20

const QUERY = `query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
  }
}`

interface Submission {
  id: string
  title: string
  titleSlug: string
  /// Unix seconds.
  timestamp: string
}

export const leetcode: Integration = {
  provider: 'LEETCODE',
  label: 'LeetCode',
  authKind: 'public-handle',
  requires: 'Your LeetCode username',
  hint: 'Accepted submissions are public, so no login or token is needed.',
  async fetchActivity({ day, timeZone, handle }) {
    if (!handle) throw new IntegrationError('A LeetCode username is required')

    const response = await fetchWithTimeout(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
      body: JSON.stringify({
        operationName: 'recentAcSubmissions',
        query: QUERY,
        variables: { username: handle, limit: MAX_LIMIT },
      }),
    })

    if (!response.ok) throw new IntegrationError(`LeetCode responded with ${response.status}`)

    const body = (await response.json()) as {
      data?: { recentAcSubmissionList?: Submission[] | null }
      errors?: { message: string }[]
    }

    if (body.errors?.length) throw new IntegrationError(body.errors[0]?.message ?? 'LeetCode query failed')

    const submissions = body.data?.recentAcSubmissionList
    if (!submissions) throw new IntegrationError(`No public profile found for "${handle}"`)

    const onDay = submissions.filter(
      (submission) => today(timeZone, new Date(Number(submission.timestamp) * 1000)) === day,
    )

    // One problem can be accepted several times; count distinct problems.
    const solved = new Set(onDay.map((submission) => submission.titleSlug))
    const titles = [...new Set(onDay.map((submission) => submission.title))]

    return { count: solved.size, detail: titles.length ? titles.join(', ') : undefined }
  },
}
