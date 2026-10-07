import type { RouteRecordRaw } from 'vue-router'

/** Exportar e importar datos (spec 014): solo el administrador de empresa (A-73). */
export const dataTransferRoutes: RouteRecordRaw[] = [
  {
    path: 'datos',
    name: 'data-transfer',
    component: () => import('./views/DataTransferView.vue'),
    meta: { roles: ['company_admin'], title: 'Importar y exportar' },
  },
]
