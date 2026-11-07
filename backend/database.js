import { mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrations = new URL('../db/', import.meta.url);
const localDir = fileURLToPath(new URL('../.data/postgres/', import.meta.url));

export async function openDatabase({ url = process.env.DATABASE_URL, directory = process.env.PLANT_DB_DIR ?? localDir } = {}) {
  if (url) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: url });
    pool.on('error', (error) => console.error('PostgreSQL pool:', error.message));
    return {
      query: (sql, params) => pool.query(sql, params),
      async transaction(run) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await run({ query: (sql, params) => client.query(sql, params), exec: (sql) => client.query(sql) });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally { client.release(); }
      },
      close: () => pool.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  if (directory !== 'memory://') {
    directory = resolve(directory);
    await mkdir(dirname(directory), { recursive: true });
  }
  const database = await PGlite.create(directory);
  return {
    query: (sql, params) => database.query(sql, params),
    transaction: (run) => database.transaction(run),
    close: () => database.close(),
  };
}

export async function migrate(database) {
  const names = (await readdir(migrations)).filter((name) => /^\d{3}_[a-z_]+\.sql$/.test(name)).sort();
  const files = await Promise.all(names.map((name) => readFile(new URL(name, migrations), 'utf8')));
  await database.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(241101, 1)');
    await tx.exec('CREATE TABLE IF NOT EXISTS public.windowsill_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const { rows } = await tx.query('SELECT name FROM public.windowsill_migrations');
    const installed = new Set(rows.map(({ name }) => name));
    if (!installed.size) {
      const { rows: [existing] } = await tx.query("SELECT to_regclass('windowsill.content_releases') IS NOT NULL AS base, to_regprocedure('windowsill.read_shared_shelf(uuid)') IS NOT NULL AS complete");
      if (existing.base && existing.complete) {
        installed.add('001_initial_schema.sql');
        const { rows: seed } = await tx.query('SELECT version FROM windowsill.content_releases WHERE version = 1');
        if (seed.length) installed.add('002_seed_demo_catalog.sql');
        for (const name of installed) await tx.query('INSERT INTO public.windowsill_migrations (name) VALUES ($1)', [name]);
      }
    }
    for (const [index, name] of names.entries()) {
      if (installed.has(name)) continue;
      await tx.exec(files[index].replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, ''));
      await tx.query('INSERT INTO public.windowsill_migrations (name) VALUES ($1)', [name]);
    }
  });
}
