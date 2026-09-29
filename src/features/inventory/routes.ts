import type { RouteRecordRaw } from 'vue-router'

export const inventoryRoutes: RouteRecordRaw[] = [
  { path: 'productos', name: 'products', component: () => import('./views/ProductsView.vue'), meta: { title: 'Productos' } },
  {
    path: 'productos/nuevo',
    name: 'product-create',
    component: () => import('./views/ProductFormView.vue'),
    meta: { roles: ['company_admin'], title: 'Nuevo producto' },
  },
  {
    path: 'productos/:id',
    name: 'product-detail',
    component: () => import('./views/ProductDetailView.vue'),
    meta: { title: 'Producto' },
  },
  {
    path: 'productos/:id/entrada',
    name: 'stock-entry',
    component: () => import('./views/StockEntryView.vue'),
    meta: { roles: ['company_admin'], title: 'Registrar entrada' },
  },
  {
    path: 'productos/:id/editar',
    name: 'product-edit',
    component: () => import('./views/ProductFormView.vue'),
    meta: { roles: ['company_admin'], title: 'Editar producto' },
  },
]
