import { createCrudRouter } from '../lib/crud.js';

export const givingRouter = createCrudRouter({
  namespace: 'giving',
  table: 'giving',
  resource: 'giving record',
  dateField: 'given_at',
  searchable: ['reference', 'notes'],
  filterable: { fund: 'fund', method: 'method', currency: 'currency', member: 'member_id' },
  sortable: ['given_at', 'amount', 'created_at', 'fund'],
  defaultSort: 'given_at',
  references: { member_id: 'members' },
  fields: {
    member_id: { type: 'integer', min: 1 },
    amount: { type: 'number', required: true, min: 0.01, max: 10_000_000 },
    currency: { type: 'string', max: 3, min: 3, default: 'USD' },
    method: {
      type: 'enum',
      values: ['cash', 'card', 'transfer', 'online', 'cheque'],
      default: 'cash',
    },
    fund: {
      type: 'enum',
      values: ['tithe', 'offering', 'missions', 'building', 'benevolence', 'other'],
      default: 'offering',
    },
    reference: { type: 'string', max: 64 },
    notes: { type: 'text', max: 1000 },
    given_at: { type: 'datetime', default: () => new Date().toISOString() },
    created_at: { type: 'datetime', system: true },
  },
});
