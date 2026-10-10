import { timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';

/** Global flood protection — generous by default, tunable via .env. */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      status: 429,
      message: 'Too many requests, please slow down and try again shortly.',
    },
  },
});

const safeEqual = (a, b) => {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

/**
 * Protects every mutating request when API_KEY is configured.
 * Reads stay public so the church website can render pages without a key.
 */
export function apiKeyGuard(req, _res, next) {
  if (!config.apiKey) return next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const provided = req.get('x-api-key');
  if (provided && safeEqual(provided, config.apiKey)) return next();

  return next(new ApiError(401, 'Missing or invalid X-API-Key header.'));
}
