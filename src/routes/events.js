import { Router } from 'express';
import { db } from '../db/index.js';
import { cache } from '../lib/cache.js';
import { createCrudRouter } from '../lib/crud.js';

const crud = createCrudRouter({
  namespace: 'events',
  table: 'events',
  resource: 'event',
  dateField: 'starts_at',
  searchable: ['title', 'description', 'location'],
  filterable: { category: 'category', recurring: 'is_recurring' },
  sortable: ['starts_at', 'created_at', 'title', 'category'],
  defaultSort: 'starts_at',
  defaultOrder: 'asc',
  fields: {
    title: { type: 'string', required: true, max: 160 },
    description: { type: 'text', max: 5000 },
    category: {
      type: 'enum',
      values: ['service', 'fellowship', 'conference', 'outreach', 'meeting', 'other'],
      default: 'service',
    },
    location: { type: 'string', max: 200 },
    starts_at: { type: 'datetime', required: true },
    ends_at: { type: 'datetime' },
    is_recurring: { type: 'boolean', default: false },
    created_at: { type: 'datetime', system: true },
    updated_at: { type: 'datetime', system: true },
  },
});

const upcomingStmt = db.prepare(
  'SELECT * FROM events WHERE starts_at >= ? ORDER BY starts_at ASC LIMIT ?',
);

const router = Router();

// GET /api/v1/events/upcoming — the homepage polls this, so it is cached.
router.get('/upcoming', cache('events.upcoming'), (req, res) => {
  const parsed = Number.parseInt(req.query.limit ?? '10', 10);
  const limit = Math.min(Number.isFinite(parsed) && parsed > 0 ? parsed : 10, 50);
  const rows = upcomingStmt.all(new Date().toISOString(), limit);
  res.json({
    data: rows.map((row) => ({ ...row, is_recurring: Boolean(row.is_recurring) })),
  });
});

router.use(crud);

export { router as eventsRouter };
