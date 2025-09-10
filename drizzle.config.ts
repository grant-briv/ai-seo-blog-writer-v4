import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.PGURL || 'postgresql://localhost:5432/ai_blog_writer',
  },
} satisfies Config;