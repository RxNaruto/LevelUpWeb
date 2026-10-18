import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from '../env.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex')

/** Returns `iv:authTag:ciphertext`, all base64. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join(':')
}

export function decrypt(payload: string): string {
  const [iv, authTag, ciphertext] = payload.split(':')
  if (!iv || !authTag || !ciphertext) throw new Error('Malformed encrypted payload')
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
