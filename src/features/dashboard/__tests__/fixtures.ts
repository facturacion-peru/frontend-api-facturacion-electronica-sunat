import { defineComponent, h, type Component } from 'vue'

import type { DashboardSummary } from '../types'

/** Monta un componente con props a través de mountWithRouter (que no las recibe). */
export function withProps(component: Component, props: Record<string, unknown>) {
  return defineComponent({ render: () => h(component, props) })
}

export const summary = (over: Partial<DashboardSummary> = {}): DashboardSummary => ({
  date: '2026-10-03',
  scope: 'company',
  today: { total: '81.60', count: 5 },
  last_7_days: [
    { date: '2026-09-27', total: '0.00', count: 0 },
    { date: '2026-09-28', total: '12.00', count: 1 },
    { date: '2026-09-29', total: '0.00', count: 0 },
    { date: '2026-09-30', total: '169.20', count: 9 },
    { date: '2026-10-01', total: '5.00', count: 1 },
    { date: '2026-10-02', total: '0.00', count: 0 },
    { date: '2026-10-03', total: '81.60', count: 5 },
  ],
  attention: { pending_documents: 2, rejected_documents: 1, inventory_alerts: 3 },
  recent_sales: [
    { kind: 'ticket', id: 41, number: 'T-000041', document_type: null, customer_name: null, total: '35.00', status: 'issued', issued_at: '2026-10-03T10:21:00-05:00' },
    { kind: 'document', id: 9, number: 'B001-00000009', document_type: '03', customer_name: 'Cliente varios', total: '120.00', status: 'accepted', issued_at: '2026-10-03T09:00:00-05:00' },
  ],
  ...over,
})
