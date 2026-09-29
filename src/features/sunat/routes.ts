import type { RouteRecordRaw } from 'vue-router'

export const sunatRoutes: RouteRecordRaw[] = [
  {
    path: 'sunat',
    name: 'sunat',
    component: () => import('./views/SunatView.vue'),
    meta: { roles: ['company_admin'], title: 'SUNAT' },
  },
  {
    path: 'series',
    name: 'series',
    component: () => import('./views/SeriesView.vue'),
    meta: { roles: ['company_admin'], title: 'Series' },
  },
]
