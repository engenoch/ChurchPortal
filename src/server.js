import process from 'node:process';
import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/index.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  logger.info('server started', {
    url: `http://${config.host}:${config.port}`,
    env: config.env,
    node: process.version,
    pid: process.pid,
  });
});

// Keep connections alive for load balancers that expect long-lived sockets.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error('port already in use', { port: config.port });
  } else {
    logger.error('server error', { message: error.message });
  }
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutting down', { signal });

  // Stop accepting new connections, let in-flight requests finish, then close
  // the database so the WAL is checkpointed to disk.
  server.close(() => {
    closeDb();
    logger.info('shutdown complete');
    process.exit(exitCode);
  });

  setTimeout(() => {
    logger.warn('forcing shutdown', { signal });
    closeDb();
    process.exit(exitCode);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  logger.error('uncaught exception', { message: error.message, stack: error.stack });
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection', { reason: String(reason) });
});

export { app, server };
