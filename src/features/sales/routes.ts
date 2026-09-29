import type { RouteRecordRaw } from 'vue-router'

export const salesRoutes: RouteRecordRaw[] = [
  { path: 'vender', name: 'new-sale', component: () => import('./views/NewSaleView.vue'), meta: { title: 'Vender' } },
  { path: 'ventas', name: 'tickets', component: () => import('./views/TicketsView.vue'), meta: { title: 'Ventas' } },
  { path: 'ventas/:id', name: 'ticket-detail', component: () => import('./views/TicketView.vue'), meta: { title: 'Ticket' } },
]
