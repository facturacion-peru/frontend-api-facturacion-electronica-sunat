import type { RouteRecordRaw } from 'vue-router'

/** Panel de la plataforma (spec 006). Se monta bajo /plataforma con su propio layout. */
export const platformRoutes: RouteRecordRaw[] = [
  { path: '', name: 'platform-companies', component: () => import('./views/CompaniesView.vue'), meta: { title: 'Empresas' } },
  { path: 'empresas/nueva', name: 'platform-company-create', component: () => import('./views/NewCompanyView.vue'), meta: { title: 'Nueva empresa' } },
  { path: 'empresas/:id', name: 'platform-company', component: () => import('./views/CompanyDetailView.vue'), meta: { title: 'Empresa' } },
  { path: 'soporte', name: 'platform-support', component: () => import('./views/SupportView.vue'), meta: { title: 'Soporte de la emisión' } },
  { path: 'auditoria', name: 'platform-audit', component: () => import('./views/PlatformAuditView.vue'), meta: { title: 'Auditoría de la plataforma' } },
]
