import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError } from '../lib/http.js'
import { logger } from '../lib/logger.js'

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({ error: `No route for ${request.method} ${request.path}`, code: 'NOT_FOUND' })
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message, code: error.code })
    return
  }

  if (error instanceof ZodError) {
    const first = error.issues[0]
    const field = first?.path.join('.')
    response.status(400).json({
      error: first ? `${field ? `${field}: ` : ''}${first.message}` : 'Invalid request',
      code: 'VALIDATION',
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      response.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
      return
    }
    if (error.code === 'P2002') {
      response.status(409).json({ error: 'That already exists', code: 'CONFLICT' })
      return
    }
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Malformed JSON body', code: 'BAD_JSON' })
    return
  }

  logger.error({ err: error, path: request.path, method: request.method }, 'Unhandled error')
  response.status(500).json({ error: 'Something went wrong on our side', code: 'INTERNAL' })
}
