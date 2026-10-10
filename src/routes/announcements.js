import { createCrudRouter } from '../lib/crud.js';

export const announcementsRouter = createCrudRouter({
  namespace: 'announcements',
  table: 'announcements',
  resource: 'announcement',
  dateField: 'created_at',
  searchable: ['title', 'body', 'author'],
  filterable: { priority: 'priority', published: 'is_published' },
  sortable: ['created_at', 'publish_at', 'priority', 'title'],
  defaultSort: 'created_at',
  fields: {
    title: { type: 'string', required: true, max: 180 },
    body: { type: 'text', required: true, max: 6000 },
    author: { type: 'string', max: 120 },
    priority: { type: 'enum', values: ['normal', 'important', 'urgent'], default: 'normal' },
    is_published: { type: 'boolean', default: true },
    publish_at: { type: 'datetime', default: () => new Date().toISOString() },
    expires_at: { type: 'datetime' },
    created_at: { type: 'datetime', system: true },
    updated_at: { type: 'datetime', system: true },
  },
});
