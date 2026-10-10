# Church Website API

A small, fast REST API for a church website — **Node.js + Express + SQLite** — designed to comfortably handle **1000+ requests per day** (and far more).

It ships with six resource areas:

| Resource | Base path | Purpose |
|---|---|---|
| Members | `/api/v1/members` | Congregants, visitors, ministers, volunteers |
| Events | `/api/v1/events` | Services, fellowships, conferences, outreach |
| Sermons | `/api/v1/sermons` | Sermon media, series, speakers, scripture |
| Giving | `/api/v1/giving` | Tithes and offerings (records only — no payment gateway) |
| Prayer requests | `/api/v1/prayers` | Submitted prayer requests and their status |
| Announcements | `/api/v1/announcements` | Church news and bulletins |

Plus operational endpoints: `GET /`, `GET /health`, `GET /health/ready`, `GET /health/stats`.

---

## Quick start

```bash
npm install
npm run seed     # optional: loads demo data
npm start        # http://127.0.0.1:3000
```

Development with auto-restart:

```bash
npm run dev
```

Reset the demo data:

```bash
npm run reset
```

Copy `.env.example` to `.env` to change the port, rate limits, cache TTL, CORS origins or to switch on API-key protection.

---

## API surface

Every resource exposes the same five operations:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/<resource>` | List with pagination, search, filtering, sorting |
| `GET` | `/api/v1/<resource>/:id` | Fetch one record |
| `POST` | `/api/v1/<resource>` | Create (returns `201` + `Location`) |
| `PATCH` | `/api/v1/<resource>/:id` | Partial update |
| `DELETE` | `/api/v1/<resource>/:id` | Delete (returns `204`) |

### List query parameters

| Parameter | Example | Notes |
|---|---|---|
| `page` | `?page=2` | 1-based, default `1` |
| `limit` | `?limit=25` | default `20`, max `100` |
| `sort` | `?sort=starts_at` | whitelisted per resource; unknown values → `400` |
| `order` | `?order=asc` | `asc` or `desc` |
| `q` | `?q=grace` | free-text search across searchable columns |
| filters | `?status=visitor&fund=tithe` | resource-specific equality filters |
| `from` / `to` | `?from=2026-10-01&to=2026-10-31` | date range; a date-only `to` includes the whole day |

### Response shapes

```jsonc
// List
{
  "data": [ { "id": 1, "first_name": "Ada", "...": "..." } ],
  "meta": { "page": 1, "limit": 20, "total": 25, "totalPages": 2, "hasNext": true, "hasPrev": false }
}

// Single
{ "data": { "id": 1, "first_name": "Ada", "...": "..." } }

// Error
{ "error": { "status": 422, "message": "Validation failed",
             "details": [ { "field": "email", "message": "must be a valid email address" } ],
             "requestId": "..." } }
```

---

## Examples

```bash
# List upcoming services
curl "http://127.0.0.1:3000/api/v1/events?category=service&sort=starts_at&order=asc&limit=5"

# Search sermons by speaker
curl "http://127.0.0.1:3000/api/v1/sermons?q=okafor"

# October tithes
curl "http://127.0.0.1:3000/api/v1/giving?fund=tithe&from=2026-10-01&to=2026-10-31"

# The next few events (homepage widget)
curl "http://127.0.0.1:3000/api/v1/events/upcoming?limit=5"

# Create a member
curl -X POST http://127.0.0.1:3000/api/v1/members \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Ruth","last_name":"Bello","email":"ruth.bello@example.org","membership_status":"member"}'

# Submit a prayer request
curl -X POST http://127.0.0.1:3000/api/v1/prayers \
  -H "Content-Type: application/json" \
  -d '{"name":"Anonymous","request":"Please pray for my family.","is_public":true}'

# Update an announcement
curl -X PATCH http://127.0.0.1:3000/api/v1/announcements/1 \
  -H "Content-Type: application/json" \
  -d '{"priority":"urgent"}'
```

### Conditional requests

Every `GET` returns an `ETag`. Repeat it with `If-None-Match` to get a body-less `304`:

```bash
ETAG=$(curl -sI http://127.0.0.1:3000/api/v1/announcements | grep -i etag | cut -d' ' -f2 | tr -d '\r')
curl -I -H "If-None-Match: $ETAG" http://127.0.0.1:3000/api/v1/announcements
```

Responses also carry `X-Cache: HIT|MISS` so you can see the cache working.

---

## Why it can handle 1000+ requests/day

1000 requests/day is roughly 0.01 req/s, so the real risk is bursts (Sunday morning) and slow queries. This API is built to make those cheap:

| Concern | What is in place |
|---|---|
| **Database** | SQLite in **WAL** mode with a 16 MB page cache and 256 MB mmap — reads never block writes |
| **Queries** | All SQL is **prepared once and reused**; no query strings are built from raw user input |
| **Indexing** | Composite indexes on every common filter/sort column (dates, status, fund, speaker…) |
| **Caching** | TTL + LRU response cache for `GET`s, invalidated automatically on any write, plus `ETag`/`304` |
| **Compression** | gzip on the wire via `compression` |
| **Payload limits** | `limit` maxes out at 100 rows, bodies at 100 KB |
| **Rate limiting** | `express-rate-limit` (default 300 req/min/IP, `draft-7` headers) |
| **Security** | `helmet`, CORS allow-list, optional `X-API-Key` on all writes, LIKE-wildcard escaping, sort/filter whitelists |
| **Observability** | Structured JSON logs with request id, status, duration and cache result |
| **Resilience** | Graceful shutdown (drain connections, checkpoint WAL), request timeouts, global error handler |
| **Validation** | `zod` schemas per resource → `422` with field-level details |

### Expected capacity

- Read (cache hit): **sub-millisecond** app time.
- Read (cache miss): **1–5 ms** on this dataset.
- Write: **2–15 ms** (includes cache invalidation).

That is well over **100 requests/second** sustained — orders of magnitude beyond 1000/day. If traffic ever grows past ~50 req/s sustained, see *Scaling up* below.

---

## Project structure

```
src/
├── server.js              entry point, listen + graceful shutdown
├── app.js                 Express app: security, compression, routes, error handling
├── config.js              environment configuration
├── db/
│   ├── index.js           SQLite connection, pragmas, schema load
│   ├── schema.sql         tables, CHECK constraints, indexes
│   └── seed.js            demo data (npm run seed / npm run reset)
├── lib/
│   ├── crud.js            generic CRUD router used by all six resources
│   ├── validators.js      field definitions → zod schemas → row mapping
│   ├── cache.js           TTL/LRU response cache + ETag/304 handling
│   ├── pagination.js      page/limit/sort/order parsing, LIKE escaping
│   ├── errors.js          ApiError helpers
│   └── logger.js          structured JSON logger
├── middleware/
│   ├── security.js        rate limiter + API-key guard
│   ├── requestLogger.js   request id, timing, structured log line
│   └── errorHandler.js    404 + normalised JSON error responses
└── routes/
    ├── index.js           mounts all resources under /api/v1
    ├── health.js          /health, /health/ready, /health/stats
    ├── members.js  events.js  sermons.js
    ├── giving.js   prayers.js  announcements.js
```

Adding a new resource is one file: describe its fields and filters, call `createCrudRouter(...)`, and mount it in `src/routes/index.js`.

---

## Protecting writes

Set an API key to require authentication on every `POST`/`PATCH`/`DELETE` (reads stay public so the website can render without a key):

```bash
# .env
API_KEY=change-me-to-a-long-random-string
```

```bash
curl -X POST http://127.0.0.1:3000/api/v1/announcements \
  -H "Content-Type: application/json" -H "X-API-Key: change-me-to-a-long-random-string" \
  -d '{"title":"Notice","body":"Service starts at 8:00 AM."}'
```

---

## Deployment notes

- **Reverse proxy / cloud**: set `TRUST_PROXY=1` (or your hop count) so rate limiting sees real client IPs.
- **CORS**: set `CORS_ORIGINS=https://yourchurch.org,https://www.yourchurch.org`.
- **Run under a process manager**: `pm2 start src/server.js --name church-api` or a systemd unit / container.
- **Backups**: copy `data/church.db` (WAL is checkpointed on graceful shutdown). `sqlite3 data/church.db ".backup backup.db"` is safe while running.
- **Health checks**: point your load balancer at `/health/ready` (it returns `503` if the DB is unreachable).

### Scaling up

If traffic grows beyond what a single process should carry:

1. Move `src/app.js` behind `node:cluster` or run several instances with a shared volume swapped for PostgreSQL.
2. Put a CDN (Cloudflare, Fastly) in front — every `GET` is already cacheable (`Cache-Control`, `ETag`).
3. Consider SQLite FTS5 for full-text search once sermons/members pass ~50k rows.

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Run the API |
| `npm run dev` | Run with automatic restart on file changes |
| `npm run seed` | Insert demo data (skips if data already exists) |
| `npm run reset` | Wipe and re-seed demo data |
# ChurchPortal
# ChurchPortal
