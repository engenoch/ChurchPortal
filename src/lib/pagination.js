import { ApiError } from './errors.js';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Parses `page`, `limit`, `sort` and `order` from the query string.
 * `sortable` is the whitelist of columns that may be sorted on.
 */
export function parsePagination(query, { sortable = [], defaultSort, defaultOrder = 'desc' } = {}) {
  const page = Number.parseInt(query.page ?? '1', 10);
  const limit = Number.parseInt(query.limit ?? String(DEFAULT_LIMIT), 10);

  if (!Number.isFinite(page) || page < 1) {
    throw ApiError.badRequest('`page` must be a positive integer.');
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw ApiError.badRequest(`\`limit\` must be between 1 and ${MAX_LIMIT}.`);
  }

  const sort = query.sort ? String(query.sort) : defaultSort;
  if (sortable.length && sort && !sortable.includes(sort)) {
    throw ApiError.badRequest(`\`sort\` must be one of: ${sortable.join(', ')}.`);
  }

  const order = String(query.order ?? defaultOrder).toLowerCase();
  if (!['asc', 'desc'].includes(order)) {
    throw ApiError.badRequest('`order` must be "asc" or "desc".');
  }

  return { page, limit, offset: (page - 1) * limit, sort, order };
}

export function buildPaginationMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/** Escapes LIKE wildcards so user input cannot turn into a pattern. */
export function likeParam(value) {
  return `%${String(value).replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}
