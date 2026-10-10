import { Router } from 'express';
import { db } from '../db/index.js';
import { ApiError } from './errors.js';
import { cache, invalidate } from './cache.js';
import { buildPaginationMeta, likeParam, parsePagination } from './pagination.js';
import { buildSchema, fromRow, parseOrThrow, toRowValue } from './validators.js';

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/**
 * Generic, fully parameterised CRUD router.
 *
 * Every resource (members, events, sermons, giving, prayers, announcements)
 * gets the same API surface:
 *
 *   GET    /api/v1/<resource>          list  ?page&limit&sort&order&q&<filters>&from&to
 *   GET    /api/v1/<resource>/:id      fetch one
 *   POST   /api/v1/<resource>          create
 *   PATCH  /api/v1/<resource>/:id      partial update
 *   DELETE /api/v1/<resource>/:id      delete
 *
 * All SQL is prepared once and reused, all input is validated, and all reads
 * go through the response cache.
 */
export function createCrudRouter(options) {
  const {
    namespace,
    table,
    resource,
    fields,
    searchable = [],
    filterable = {},
    sortable = [],
    defaultSort,
    defaultOrder = 'desc',
    dateField,
    references = {},
    maxLimit,
  } = options;

  const router = Router();
  const insertSchema = buildSchema(fields);
  const patchSchema = buildSchema(fields, { partial: true });

  // Must be registered before the routes so it wraps every GET response.
  router.use(cache(namespace));

  const columns = Object.keys(fields);
  const columnList = columns.join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const filterColumns = Array.isArray(filterable)
    ? Object.fromEntries(filterable.map((column) => [column, column]))
    : filterable;

  /** Prepared statements are cached per SQL string — SQL is compiled once. */
  const statements = new Map();
  const prepare = (sql) => {
    let statement = statements.get(sql);
    if (!statement) {
      statement = db.prepare(sql);
      statements.set(sql, statement);
    }
    return statement;
  };

  const now = () => new Date().toISOString();

  const parseId = (raw) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
      throw ApiError.badRequest('`id` must be a positive integer.');
    }
    return id;
  };

  const findOrThrow = (id) => {
    const row = prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!row) throw ApiError.notFound(`${resource} ${id} not found.`);
    return row;
  };

  /** Builds the WHERE clause + bound params from the query string. */
  function buildWhere(query) {
    const clauses = [];
    const params = [];

    const term = query.q ? String(query.q).trim() : '';
    if (term && searchable.length) {
      clauses.push(`(${searchable.map((column) => `${column} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
      for (const _ of searchable) params.push(likeParam(term));
    }

    for (const [param, column] of Object.entries(filterColumns)) {
      const raw = query[param];
      if (raw === undefined || raw === '') continue;
      const def = fields[column];
      if (def?.type === 'boolean') {
        clauses.push(`${column} = ?`);
        params.push(['true', '1', 'yes', 'on'].includes(String(raw).toLowerCase()) ? 1 : 0);
      } else if (def?.type === 'enum' && !def.values.includes(String(raw))) {
        throw ApiError.badRequest(`\`${param}\` must be one of: ${def.values.join(', ')}.`);
      } else {
        clauses.push(`${column} = ?`);
        params.push(raw);
      }
    }

    if (dateField && (query.from || query.to)) {
      if (query.from) {
        if (!ISO_DATE_ONLY.test(query.from) && !ISO_DATETIME.test(query.from)) {
          throw ApiError.badRequest('`from` must be YYYY-MM-DD or an ISO 8601 date-time.');
        }
        clauses.push(`${dateField} >= ?`);
        params.push(query.from);
      }
      if (query.to) {
        if (!ISO_DATE_ONLY.test(query.to) && !ISO_DATETIME.test(query.to)) {
          throw ApiError.badRequest('`to` must be YYYY-MM-DD or an ISO 8601 date-time.');
        }
        // A date-only `to` is treated as inclusive of that whole day.
        if (ISO_DATE_ONLY.test(query.to)) {
          clauses.push(`${dateField} < datetime(?, '+1 day')`);
          params.push(query.to);
        } else {
          clauses.push(`${dateField} <= ?`);
          params.push(query.to);
        }
      }
    }

    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
  }

  // ---------------------------------------------------------------- list ----
  router.get('/', (req, res) => {
    const { page, limit, offset, sort, order } = parsePagination(req.query, {
      sortable,
      defaultSort: defaultSort ?? sortable[0],
      defaultOrder,
    });
    if (maxLimit && limit > maxLimit) {
      throw ApiError.badRequest(`\`limit\` must be at most ${maxLimit}.`);
    }

    const { where, params } = buildWhere(req.query);
    const total = prepare(`SELECT COUNT(*) AS n FROM ${table} ${where}`).get(...params).n;

    const rows = prepare(
      `SELECT * FROM ${table} ${where}
       ORDER BY ${sort} ${order.toUpperCase()}, id ${order.toUpperCase()}
       LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset);

    res.json({
      data: rows.map((row) => fromRow(fields, row)),
      meta: buildPaginationMeta({ page, limit, total }),
    });
  });

  // --------------------------------------------------------------- read ----
  router.get('/:id', (req, res) => {
    const row = findOrThrow(parseId(req.params.id));
    res.json({ data: fromRow(fields, row) });
  });

  // -------------------------------------------------------------- write ----
  router.post('/', (req, res) => {
    const parsed = parseOrThrow(insertSchema, req.body ?? {});
    const timestamp = now();
    const values = [];

    for (const column of columns) {
      const def = fields[column];
      if (def.system) {
        values.push(column === 'id' ? null : timestamp);
        continue;
      }
      const value = parsed[column];
      if (value !== undefined && value !== null) values.push(toRowValue(def, value));
      else if (def.default !== undefined) {
        values.push(typeof def.default === 'function' ? def.default() : def.default);
      } else values.push(null);
    }

    assertReferences(parsed);

    let info;
    try {
      info = prepare(`INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`).run(...values);
    } catch (error) {
      throw translateSqliteError(error, resource);
    }

    const row = prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    invalidate(namespace);
    res
      .status(201)
      .location(`/api/v1/${namespace}/${row.id}`)
      .json({ data: fromRow(fields, row) });
  });

  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    findOrThrow(id);

    const parsed = parseOrThrow(patchSchema, req.body ?? {});
    const entries = Object.entries(parsed).filter(([, value]) => value !== undefined);
    if (!entries.length) throw ApiError.badRequest('Request body has no updatable fields.');

    assertReferences(parsed);

    const assignments = entries.map(([column]) => `${column} = ?`);
    if ('updated_at' in fields) assignments.push('updated_at = ?');

    const values = entries.map(([column, value]) => toRowValue(fields[column], value));
    if ('updated_at' in fields) values.push(now());

    try {
      prepare(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`).run(...values, id);
    } catch (error) {
      throw translateSqliteError(error, resource);
    }

    invalidate(namespace);
    res.json({ data: fromRow(fields, prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)) });
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    findOrThrow(id);
    prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    invalidate(namespace);
    res.status(204).end();
  });

  /** Verifies foreign keys exist so we return a 400 instead of a SQL error. */
  function assertReferences(parsed) {
    for (const [column, target] of Object.entries(references)) {
      const value = parsed[column];
      if (value === undefined || value === null) continue;
      const exists = db.prepare(`SELECT 1 FROM ${target} WHERE id = ?`).get(value);
      if (!exists) throw ApiError.badRequest(`\`${column}\` references an unknown ${target} id.`);
    }
  }

  return router;
}

function translateSqliteError(error, resource) {
  const message = String(error?.message ?? '');
  if (message.includes('UNIQUE constraint failed')) {
    return ApiError.conflict(`That ${resource} already exists.`, { constraint: message });
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return ApiError.badRequest('Referenced record does not exist.');
  }
  if (message.includes('CHECK constraint failed')) {
    return ApiError.unprocessable('A field value is not allowed.', { constraint: message });
  }
  return error;
}
