import type { RouteRecordRaw } from 'vue-router'

export const usersRoutes: RouteRecordRaw[] = [
  {
    path: 'usuarios',
    name: 'users',
    component: () => import('./views/UsersView.vue'),
    meta: { roles: ['company_admin'], title: 'Usuarios' },
  },
]
