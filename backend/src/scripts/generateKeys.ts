import { randomBytes } from 'node:crypto'
import webpush from 'web-push'

const vapid = webpush.generateVAPIDKeys()

console.log(`JWT_SECRET=${randomBytes(48).toString('base64url')}`)
console.log(`ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`)
console.log(`VAPID_PUBLIC_KEY=${vapid.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${vapid.privateKey}`)
