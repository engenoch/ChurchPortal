/**
 * Minimal error type used across the API. Anything that is not an ApiError is
 * treated as an unexpected server error by the global error handler.
 */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists', details) {
    return new ApiError(409, message, details);
  }

  static unprocessable(message = 'Validation failed', details) {
    return new ApiError(422, message, details);
  }
}
