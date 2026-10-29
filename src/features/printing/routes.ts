import type { RouteRecordRaw } from 'vue-router'

/** Impresora térmica Bluetooth (spec 015): cualquier usuario de empresa, solo en la app Android. */
export const printingRoutes: RouteRecordRaw[] = [
  {
    path: 'impresora',
    name: 'printer',
    component: () => import('./views/PrinterView.vue'),
    meta: { nativeOnly: true, title: 'Impresora' },
  },
]
