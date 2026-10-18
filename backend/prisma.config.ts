import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` doesn't connect, so it shouldn't fail when the URL is unset.
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/levelup',
  },
})
