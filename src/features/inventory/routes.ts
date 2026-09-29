import type { RouteRecordRaw } from 'vue-router'

export const inventoryRoutes: RouteRecordRaw[] = [
  { path: 'productos', name: 'products', component: () => import('./views/ProductsView.vue'), meta: { title: 'Productos' } },
]
