import type { RouteRecordRaw } from 'vue-router'

export const companyRoutes: RouteRecordRaw[] = [
  {
    path: 'empresa',
    name: 'company',
    component: () => import('./views/CompanyView.vue'),
    meta: { roles: ['company_admin'], title: 'Mi empresa' },
  },
  {
    path: 'empresa/locales/nuevo',
    name: 'establishment-create',
    component: () => import('./views/EstablishmentFormView.vue'),
    meta: { roles: ['company_admin'], title: 'Nuevo local' },
  },
  {
    path: 'empresa/locales/:id',
    name: 'establishment-edit',
    component: () => import('./views/EstablishmentFormView.vue'),
    meta: { roles: ['company_admin'], title: 'Editar local' },
  },
]
