import type { RouteRecordRaw } from 'vue-router'

export const salesRoutes: RouteRecordRaw[] = [
  { path: 'vender', name: 'new-sale', component: () => import('./views/NewSaleView.vue'), meta: { title: 'Vender' } },
  { path: 'ventas', name: 'tickets', component: () => import('./views/TicketsView.vue'), meta: { title: 'Ventas' } },
  { path: 'ventas/comprobantes', name: 'sales-documents', component: () => import('./views/SalesDocumentsView.vue'), meta: { title: 'Comprobantes' } },
  { path: 'ventas/comprobantes/:id', name: 'sales-document-detail', component: () => import('./views/SalesDocumentView.vue'), meta: { title: 'Comprobante' } },
  { path: 'clientes', name: 'customers', component: () => import('./views/CustomersView.vue'), meta: { roles: ['company_admin'], title: 'Clientes' } },
  { path: 'ventas/:id', name: 'ticket-detail', component: () => import('./views/TicketView.vue'), meta: { title: 'Ticket' } },
]
