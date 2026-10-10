import { Router } from 'express';
import { db } from '../db/index.js';
import { tableCount } from '../db/index.js';

const startedAt = Date.now();
const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'church-api',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

/** Readiness — returns 503 when the database is unreachable. */
router.get('/ready', (_req, res) => {
  try {
    db.prepare('SELECT 1 AS ok').get();
    res.json({ status: 'ready', database: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'unavailable', database: error.message });
  }
});

router.get('/stats', (_req, res) => {
  res.json({
    data: {
      members: tableCount('members'),
      events: tableCount('events'),
      sermons: tableCount('sermons'),
      givingRecords: tableCount('giving'),
      prayerRequests: tableCount('prayer_requests'),
      announcements: tableCount('announcements'),
    },
  });
});

export { router as healthRouter };
