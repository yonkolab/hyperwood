import { resolve } from 'node:path';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../../src/db/schema';
import { applyTestEnv } from './env';

type TestDatabaseState = {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: ReturnType<typeof drizzle<typeof schema>>;
};

let statePromise: Promise<TestDatabaseState> | undefined;

async function startDatabase(): Promise<TestDatabaseState> {
  applyTestEnv();

  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('hyperwood_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  process.env.DATABASE_URL = container.getConnectionUri();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const db = drizzle({
    client: pool,
    schema,
  });

  await migrate(db, {
    migrationsFolder: resolve(process.cwd(), 'drizzle/migrations'),
  });

  return {
    container,
    pool,
    db,
  };
}

export async function ensureTestDatabase() {
  if (!statePromise) {
    statePromise = startDatabase();
  }

  return statePromise;
}

export async function getTestDb() {
  return (await ensureTestDatabase()).db;
}

export async function resetTestDatabase() {
  const { pool } = await ensureTestDatabase();
  const result = await pool.query<{
    schemaname: string;
    tablename: string;
  }>(
    `
      select schemaname, tablename
      from pg_tables
      where schemaname = 'public'
        and tablename not in ('__drizzle_migrations')
      order by tablename
    `,
  );

  if (result.rows.length === 0) {
    return;
  }

  const tableNames = result.rows
    .map((row) => `"${row.schemaname}"."${row.tablename}"`)
    .join(', ');

  await pool.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
}

export async function stopTestDatabase() {
  if (!statePromise) {
    return;
  }

  const state = await statePromise;
  statePromise = undefined;

  try {
    const { closeDatabaseConnections } = await import('../../src/db/client.js');
    await closeDatabaseConnections();
  } catch {
    // The app DB client is only imported in DB-backed tests.
  }

  await state.pool.end();
  await state.container.stop();
}
