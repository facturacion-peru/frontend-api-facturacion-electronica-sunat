import type { RouteRecordRaw } from 'vue-router'

export const auditRoutes: RouteRecordRaw[] = [
  {
    path: 'auditoria',
    name: 'audit',
    component: () => import('./views/AuditView.vue'),
    meta: { roles: ['company_admin'], title: 'Auditoría' },
  },
]
