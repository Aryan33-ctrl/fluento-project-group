import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { recoverPendingSessions } from './jobs/queue.js';

await connectDb();
await recoverPendingSessions();
const server = createApp().listen(env.PORT, () => logger.info(`Fluento API on :${env.PORT}`));
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.warn({ port: env.PORT }, 'Fluento API is already running on this port');
  } else {
    logger.error({ err: err.message, port: env.PORT }, 'Failed to start Fluento API');
  }
  process.exitCode = err.code === 'EADDRINUSE' ? 0 : 1;
});
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop); process.on('SIGINT', stop);
