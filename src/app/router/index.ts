import { createRouter, createWebHistory } from 'vue-router'

/**
 * Router de la aplicación.
 *
 * Las rutas de cada dominio se declararán en su propia feature
 * (`src/features/<dominio>/routes.ts`) y se montarán aquí, para que agregar un
 * módulo no obligue a tocar un archivo central que crece sin control.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/app/views/HomeView.vue'),
    },
  ],
})

export default router
