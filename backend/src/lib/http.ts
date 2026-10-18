export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`, 'NOT_FOUND')
