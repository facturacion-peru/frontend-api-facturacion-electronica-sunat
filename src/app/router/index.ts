import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { env } from '@/core/config/env'
import { authGuard } from '@/core/auth/guards'
import { authRoutes } from '@/features/auth/routes'
import { companyRoutes } from '@/features/company/routes'
import { usersRoutes } from '@/features/users/routes'
import { auditRoutes } from '@/features/audit/routes'

/**
 * Router de la aplicación. Cada feature declara sus rutas en su propio
 * `routes.ts` y aquí solo se montan dentro del layout que corresponde.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/app/layouts/AuthLayout.vue'),
    children: authRoutes,
  },
  {
    path: '/',
    component: () => import('@/app/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'home', component: () => import('@/app/views/HomeView.vue'), meta: { title: 'Inicio' } },
      ...companyRoutes,
      ...usersRoutes,
      ...auditRoutes,
    ],
  },
  {
    path: '/plataforma',
    name: 'platform-admin',
    component: () => import('@/app/views/PlatformAdminView.vue'),
    meta: { requiresAuth: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(authGuard)

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${env.appName}` : env.appName
})

export default router
