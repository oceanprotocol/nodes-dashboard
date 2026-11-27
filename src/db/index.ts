import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let instance: NeonHttpDatabase<typeof schema> | null = null;

export const getDb = () => {
  if (instance) {
    return instance;
  }
  const url = process.env.DB_DATABASE_URL;
  if (!url) {
    throw new Error('DB_DATABASE_URL is not set');
  }
  instance = drizzle(neon(url), { schema });
  return instance;
};
