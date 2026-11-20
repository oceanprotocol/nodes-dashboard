import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let instance: NeonHttpDatabase<typeof schema> | null = null;

export const getDb = () => {
  if (instance) {
    return instance;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  instance = drizzle(neon(url), { schema });
  return instance;
};
