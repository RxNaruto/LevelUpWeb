import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '../env.js'
import { PrismaClient } from '../generated/prisma/client.js'

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
})

export const prisma = new PrismaClient({ adapter })

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
