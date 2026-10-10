import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/** Assigns a request id and records method, path, status and duration. */
export function requestLogger(req, res, next) {
  req.id = req.get('x-request-id') ?? randomUUID();
  res.setHeader('X-Request-Id', req.id);
  if (!config.requestLog) return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('request', {
      id: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Number(durationMs.toFixed(2)),
      cache: res.getHeader('X-Cache'),
      ip: req.ip,
    });
  });
  return next();
}
