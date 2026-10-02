import { startServer } from './server/server.ts';

startServer().catch((err) => {
  console.error('[VED SERVER FATAL]', err);
  process.exit(1);
});
