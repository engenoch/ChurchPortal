import { createCrudRouter } from '../lib/crud.js';

export const sermonsRouter = createCrudRouter({
  namespace: 'sermons',
  table: 'sermons',
  resource: 'sermon',
  dateField: 'published_at',
  searchable: ['title', 'speaker', 'series', 'scripture', 'summary'],
  filterable: { type: 'media_type', speaker: 'speaker', series: 'series' },
  sortable: ['published_at', 'created_at', 'title', 'speaker'],
  defaultSort: 'published_at',
  fields: {
    title: { type: 'string', required: true, max: 200 },
    speaker: { type: 'string', required: true, max: 120 },
    series: { type: 'string', max: 120 },
    scripture: { type: 'string', max: 120 },
    summary: { type: 'text', max: 4000 },
    media_type: { type: 'enum', values: ['audio', 'video', 'text'], default: 'audio' },
    media_url: { type: 'string', max: 600 },
    duration_seconds: { type: 'integer', min: 0, max: 86_400 },
    published_at: { type: 'datetime', system: true },
    created_at: { type: 'datetime', system: true },
    updated_at: { type: 'datetime', system: true },
  },
});
