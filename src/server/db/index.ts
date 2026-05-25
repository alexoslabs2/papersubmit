import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Kysely, Migrator, PostgresDialect, FileMigrationProvider } from 'kysely';
import pg from 'pg';
import type { Database } from './schema.js';

const { Pool } = pg;

export function createDb(databaseUrl: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: databaseUrl })
    })
  });
}

export async function runMigrations(db: Kysely<Database>): Promise<void> {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationFolder = path.resolve(dirname, '../../migrations');
  const distMigrationFolder = path.resolve(process.cwd(), 'dist/migrations');
  const fallbackFolder = path.resolve(process.cwd(), 'migrations');
  const folder = await fs
    .access(distMigrationFolder)
    .then(() => distMigrationFolder)
    .catch(() => fs
    .access(migrationFolder)
    .then(() => migrationFolder)
    .catch(() => fallbackFolder));

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: folder
    })
  });

  const { error, results } = await migrator.migrateToLatest();
  for (const result of results ?? []) {
    console.info(`migration ${result.migrationName}: ${result.status}`);
  }
  if (error) {
    console.error('migration failed', error);
    throw error;
  }
}

export async function importMigration(modulePath: string): Promise<unknown> {
  return import(pathToFileURL(modulePath).toString());
}
