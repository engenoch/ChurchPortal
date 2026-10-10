import { createHash } from 'node:crypto';
import { config } from '../config.js';

/**
 * Small TTL + LRU cache used to serve repeat GET requests without touching
 * SQLite. At 1000+ requests/day most reads are repeat views of the same list,
 * so this keeps the database file almost idle.
 */
class TtlCache {
  constructor({ ttlMs, maxEntries }) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh LRU position.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      this.store.delete(this.store.keys().next().value);
    }
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }
}

export const responseCache = new TtlCache({
  ttlMs: config.cache.ttlSeconds * 1000,
  maxEntries: config.cache.maxEntries,
});

/** Bumping a version invalidates every cached key for that namespace. */
const versions = new Map();

export function invalidate(namespace) {
  versions.set(namespace, (versions.get(namespace) ?? 0) + 1);
  responseCache.clear();
}

function versionOf(namespace) {
  return versions.get(namespace) ?? 0;
}

const etagFor = (body) =>
  `"${createHash('sha1').update(body).digest('base64url').slice(0, 27)}"`;

/**
 * Caches successful GET responses for `namespace` and honours If-None-Match
 * so repeat visitors get a cheap 304 Not Modified.
 */
export function cache(namespace, ttlSeconds) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = `${namespace}|v${versionOf(namespace)}|${req.originalUrl}`;
    const hit = responseCache.get(key);

    if (hit) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('ETag', hit.etag);
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds ?? config.cache.ttlSeconds}`);
      if (req.headers['if-none-match'] === hit.etag) return res.status(304).end();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(hit.body);
    }

    res.setHeader('X-Cache', 'MISS');

    const originalSend = res.send.bind(res);
    res.send = (body) => {
      if (res.statusCode === 200 && typeof body === 'string' && body.length < 200_000) {
        const etag = etagFor(body);
        responseCache.set(key, { body, etag });
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds ?? config.cache.ttlSeconds}`);
        if (req.headers['if-none-match'] === etag) {
          res.status(304);
          return res.end();
        }
      }
      return originalSend(body);
    };

    return next();
  };
}
