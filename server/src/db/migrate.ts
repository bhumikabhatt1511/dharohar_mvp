import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, initDbConnection, getDbHealth } from './db';

export async function runMigrations() {
  console.log('[DHAROHAR DB] Running database migrations...');
  const health = await initDbConnection();

  if (health.storageMode !== 'postgres-postgis') {
    console.warn('[DHAROHAR DB] PostgreSQL is not reachable. Migration script skipped in dev-fallback mode.');
    return;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[DHAROHAR DB] Migrations applied successfully with PostGIS spatial tables.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[DHAROHAR DB] Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

