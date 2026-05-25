import { buildApp } from './app.js';
import { createDb, runMigrations } from './db/index.js';
import { loadEnv } from './env.js';
import { seedDefaultTemplates } from './email/templates.js';
import { ensureSetupToken } from './setup/token.js';
import { WorkerRegistry } from './workers/registry.js';
import { startEmailWorker } from './workers/emailWorker.js';
import { startEventWorker } from './workers/eventWorker.js';
import { startSessionPurgeWorker } from './workers/sessionPurgeWorker.js';

async function main() {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  try {
    await runMigrations(db);
  } catch {
    process.exit(1);
  }

  await seedDefaultTemplates(db);
  await ensureSetupToken(db, env);

  const workers = new WorkerRegistry();
  startEmailWorker(db, env, workers);
  startEventWorker(db);
  startSessionPurgeWorker(db, workers, env.SESSION_INACTIVITY_MINUTES);

  const app = await buildApp({ db, env, workers });
  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
