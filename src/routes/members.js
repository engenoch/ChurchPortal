import { createCrudRouter } from '../lib/crud.js';

export const membersRouter = createCrudRouter({
  namespace: 'members',
  table: 'members',
  resource: 'member',
  dateField: 'created_at',
  searchable: ['first_name', 'last_name', 'email', 'phone', 'family_group'],
  filterable: {
    status: 'membership_status',
    active: 'is_active',
    family: 'family_group',
  },
  sortable: ['created_at', 'joined_at', 'last_name', 'first_name', 'membership_status'],
  defaultSort: 'created_at',
  fields: {
    first_name: { type: 'string', required: true, max: 80 },
    last_name: { type: 'string', required: true, max: 80 },
    email: { type: 'email', required: true },
    phone: { type: 'phone' },
    address: { type: 'text', max: 300 },
    membership_status: {
      type: 'enum',
      values: ['visitor', 'member', 'minister', 'volunteer'],
      default: 'visitor',
    },
    family_group: { type: 'string', max: 60 },
    is_active: { type: 'boolean', default: true },
    joined_at: { type: 'datetime' },
    created_at: { type: 'datetime', system: true },
    updated_at: { type: 'datetime', system: true },
  },
});
