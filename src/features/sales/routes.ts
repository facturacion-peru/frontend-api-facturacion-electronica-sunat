import type { RouteRecordRaw } from 'vue-router'

export const salesRoutes: RouteRecordRaw[] = [
  { path: 'vender', name: 'new-sale', component: () => import('./views/NewSaleView.vue'), meta: { title: 'Vender' } },
]
