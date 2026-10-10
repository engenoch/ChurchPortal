import { createCrudRouter } from '../lib/crud.js';

export const prayersRouter = createCrudRouter({
  namespace: 'prayers',
  table: 'prayer_requests',
  resource: 'prayer request',
  dateField: 'submitted_at',
  searchable: ['name', 'email', 'request'],
  filterable: { status: 'status', public: 'is_public' },
  sortable: ['submitted_at', 'updated_at', 'status'],
  defaultSort: 'submitted_at',
  fields: {
    name: { type: 'string', required: true, max: 120 },
    email: { type: 'email' },
    request: { type: 'text', required: true, max: 2000 },
    is_public: { type: 'boolean', default: false },
    status: {
      type: 'enum',
      values: ['pending', 'approved', 'declined', 'answered'],
      default: 'pending',
    },
    submitted_at: { type: 'datetime', system: true },
    updated_at: { type: 'datetime', system: true },
  },
});
