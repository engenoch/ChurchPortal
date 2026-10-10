import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { config } from './config.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiKeyGuard, apiLimiter } from './middleware/security.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Set TRUST_PROXY=1 when running behind nginx/Azure/App Service so rate
  // limiting sees the real client IP instead of the proxy's.
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(compression()); // gzip every JSON payload on the wire
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(requestLogger);

  app.use('/health', healthRouter);

  // Site root — points clients at the versioned API.
  app.get('/', (_req, res) => {
    res.json({
      name: 'Church Website API',
      version: '1.0.0',
      api: '/api/v1',
      health: '/health',
      documentation: 'See README.md',
    });
  });

  app.use('/api/v1', apiLimiter, apiKeyGuard, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
