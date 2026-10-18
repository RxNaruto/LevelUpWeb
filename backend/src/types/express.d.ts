import 'express'

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        sessionId: string
        /// The caller's IANA timezone: the X-Timezone header when valid, else the account's.
        timezone: string
      }
    }
  }
}
