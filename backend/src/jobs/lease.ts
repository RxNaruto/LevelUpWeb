import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma.js'

const HOLDER = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`

/**
 * Takes a named lease for `ttlMs` if nobody else holds an unexpired one, so a
 * job scheduled on every instance still runs exactly once per tick.
 */
export async function tryAcquireLease(name: string, ttlMs: number): Promise<boolean> {
  const until = new Date(Date.now() + ttlMs)
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    INSERT INTO "JobLease" (name, holder, "leasedUntil")
    VALUES (${name}, ${HOLDER}, ${until})
    ON CONFLICT (name) DO UPDATE
      SET holder = EXCLUDED.holder, "leasedUntil" = EXCLUDED."leasedUntil"
      WHERE "JobLease"."leasedUntil" < now() OR "JobLease".holder = EXCLUDED.holder
    RETURNING name`
  return rows.length > 0
}

export async function releaseLease(name: string): Promise<void> {
  await prisma.jobLease.updateMany({
    where: { name, holder: HOLDER },
    data: { leasedUntil: new Date(0) },
  })
}
