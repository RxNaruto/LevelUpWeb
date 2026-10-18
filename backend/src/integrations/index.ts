import type { Provider } from '../generated/prisma/enums.js'
import { duolingo } from './duolingo.js'
import { leetcode } from './leetcode.js'
import type { Integration } from './types.js'
import { velocityfit } from './velocityfit.js'

/// takeUforward is Google-login only with no public API, so it stays a manually tracked source.
const takeuforward: Integration = {
  provider: 'TAKEUFORWARD',
  label: 'takeUforward',
  authKind: 'manual',
  requires: 'Nothing — tick these off yourself',
  hint: 'takeUforward uses Google sign-in and exposes no public API, so automatic tracking would need a browser extension.',
}

const manual: Integration = {
  provider: 'MANUAL',
  label: 'Personal',
  authKind: 'manual',
  requires: 'Nothing',
}

export const integrations: Record<Provider, Integration> = {
  MANUAL: manual,
  LEETCODE: leetcode,
  TAKEUFORWARD: takeuforward,
  DUOLINGO: duolingo,
  VELOCITYFIT: velocityfit,
}

/// Providers a connection can be configured for, in display order.
export const connectableProviders: Provider[] = ['LEETCODE', 'TAKEUFORWARD', 'DUOLINGO', 'VELOCITYFIT']

export const autoTrackableProviders: Provider[] = connectableProviders.filter(
  (provider) => typeof integrations[provider].fetchActivity === 'function',
)

export function getIntegration(provider: Provider): Integration {
  return integrations[provider]
}

export { IntegrationError } from './types.js'
export type { ActivityResult, AuthKind, Integration } from './types.js'
