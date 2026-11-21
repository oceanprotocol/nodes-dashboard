import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL must be set');
}

export default defineConfig({
  dbCredentials: { url },
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/db/schema.ts',
});
