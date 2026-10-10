import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}.`));
}

/** Normalises body-parser, SQLite and unknown errors into JSON responses. */
export function errorHandler(error, req, res, _next) {
  let apiError = error;

  if (error?.type === 'entity.too.large') {
    apiError = new ApiError(413, 'Request body is too large.');
  } else if (error?.type === 'entity.parse.failed') {
    apiError = new ApiError(400, 'Request body is not valid JSON.');
  } else if (!(error instanceof ApiError)) {
    logger.error('unhandled error', {
      id: req.id,
      method: req.method,
      path: req.originalUrl,
      message: error?.message,
      stack: error?.stack,
    });
    apiError = new ApiError(500, 'Something went wrong on our side.');
  }

  const status = apiError.status ?? 500;
  if (status >= 500) {
    logger.error('server error', { id: req.id, path: req.originalUrl, message: error?.message });
  }

  res.status(status).json({
    error: {
      status,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
      ...(status >= 500 && !config.isProduction ? { stack: error.stack } : {}),
      requestId: req.id,
    },
  });
}
