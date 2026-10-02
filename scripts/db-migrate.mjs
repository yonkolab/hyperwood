import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, max: 1 });

try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: './drizzle/migrations',
  });
  console.log('database migrations applied');
} finally {
  await pool.end();
}
