import { z } from 'zod';
import { ApiError } from './errors.js';

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const coerceBoolean = z.preprocess((value) => {
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  if (typeof value === 'number') return value !== 0;
  return value;
}, z.boolean());

/** Builds the zod validator for a single field definition. */
export function zodFor(def) {
  switch (def.type) {
    case 'string':
      return z.string().trim().min(def.min ?? 1).max(def.max ?? 255);
    case 'text':
      return z.string().trim().min(def.min ?? 1).max(def.max ?? 10_000);
    case 'email':
      return z
        .string()
        .trim()
        .toLowerCase()
        .max(254)
        .regex(EMAIL, 'must be a valid email address');
    case 'phone':
      return z
        .string()
        .trim()
        .max(32)
        .regex(/^[+\d][\d\s()-]{5,}$/, 'must be a valid phone number');
    case 'integer':
      return z.coerce
        .number({ error: 'must be a number' })
        .int('must be an integer')
        .min(def.min ?? -2_147_483_648)
        .max(def.max ?? 2_147_483_647);
    case 'number':
      return z.coerce.number({ error: 'must be a number' }).min(def.min).max(def.max);
    case 'boolean':
      return coerceBoolean;
    case 'datetime':
      return z.string().trim().regex(ISO_DATE, 'must be an ISO 8601 date/time');
    case 'enum':
      return z.enum(def.values);
    default:
      throw new Error(`Unknown field type: ${def.type}`);
  }
}

/**
 * Turns a `{ column: definition }` map into a zod object schema.
 * `partial` is used for PATCH, where every column is optional.
 */
export function buildSchema(fields, { partial = false } = {}) {
  const shape = {};
  for (const [column, def] of Object.entries(fields)) {
    if (def.system) continue; // timestamps and friends are server-managed
    let schema = zodFor(def);
    if (partial) {
      // Fields with a default cannot be cleared with `null`; optional ones can.
      shape[column] =
        def.required || def.default !== undefined ? schema.optional() : schema.nullish();
    } else if (def.required) {
      shape[column] = schema;
    } else if (def.default !== undefined && typeof def.default !== 'function') {
      shape[column] = schema.default(def.default);
    } else {
      // No default, or a dynamic default (a function) which must be evaluated
      // per request in the INSERT builder, not once at boot.
      shape[column] = schema.nullish();
    }
  }
  return z.object(shape);
}

/** Validates a value and throws a 422 ApiError with per-field details. */
export function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '(body)',
    message: issue.message,
  }));
  throw ApiError.unprocessable('Validation failed', details);
}

/** Converts parsed values into something SQLite can bind (booleans → 0/1). */
export function toRowValue(def, value) {
  if (value === undefined || value === null) return null;
  return def.type === 'boolean' ? (value ? 1 : 0) : value;
}

/** Converts a SQLite row back into the API representation. */
export function fromRow(fields, row) {
  if (!row) return row;
  const out = { ...row };
  for (const [column, def] of Object.entries(fields)) {
    if (def.type === 'boolean' && column in out) out[column] = Boolean(out[column]);
  }
  return out;
}
