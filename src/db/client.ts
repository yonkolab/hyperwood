import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

export const dbPool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle({
  client: dbPool,
  schema,
});

export async function closeDatabaseConnections() {
  await dbPool.end();
}
