import { Router } from 'express';
import { config } from '../config.js';
import { cache } from '../lib/cache.js';
import { announcementsRouter } from './announcements.js';
import { eventsRouter } from './events.js';
import { givingRouter } from './giving.js';
import { membersRouter } from './members.js';
import { prayersRouter } from './prayers.js';
import { sermonsRouter } from './sermons.js';

const router = Router();

const RESOURCES = {
  members: '/api/v1/members',
  events: '/api/v1/events',
  sermons: '/api/v1/sermons',
  giving: '/api/v1/giving',
  prayers: '/api/v1/prayers',
  announcements: '/api/v1/announcements',
};

router.get('/', cache('root'), (_req, res) => {
  res.json({
    name: 'Church Website API',
    version: '1.0.0',
    status: 'ok',
    environment: config.env,
    documentation: 'See README.md',
    endpoints: {
      health: ['/health', '/health/ready', '/health/stats'],
      ...RESOURCES,
    },
  });
});

router.use('/members', membersRouter);
router.use('/events', eventsRouter);
router.use('/sermons', sermonsRouter);
router.use('/giving', givingRouter);
router.use('/prayers', prayersRouter);
router.use('/announcements', announcementsRouter);

export { router as apiRouter };
