import type { RouteRecordRaw } from 'vue-router'

export const companyRoutes: RouteRecordRaw[] = [
  {
    path: 'empresa',
    name: 'company',
    component: () => import('./views/CompanyView.vue'),
    meta: { roles: ['company_admin'], title: 'Mi empresa' },
  },
]
