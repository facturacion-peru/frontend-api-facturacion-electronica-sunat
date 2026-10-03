<script setup lang="ts">
import { useRoute } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'

/**
 * Navegación de la barra lateral (spec 010, HU-6). Lo del día a día va
 * primero; la gestión del administrador, en su propio grupo. En la barra
 * lateral hay altura para todo, así que ya no hace falta el menú «Más».
 */
const session = useSessionStore()
const route = useRoute()

interface Item {
  to: string
  label: string
  /** Trazos del ícono (24×24, sin relleno). */
  icon: string
  exact?: boolean
}

/** Círculo como trazo de path, para mantener cada ícono en un solo `d`. */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

const primary: Item[] = [
  { to: '/', label: 'Inicio', exact: true, icon: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M10 20v-6h4v6' },
  { to: '/vender', label: 'Vender', icon: `${circle(12, 12, 9)}M12 8v8M8 12h8` },
  { to: '/ventas', label: 'Ventas', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3' },
  { to: '/productos', label: 'Productos', icon: 'M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4zM3.5 7.5 12 11.5l8.5-4M12 11.5v9' },
]

const admin: Item[] = [
  { to: '/inventario/alertas', label: 'Alertas', icon: 'M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9M10 20.5h4' },
  { to: '/clientes', label: 'Clientes', icon: `${circle(12, 8, 4)}M4.5 20.5a7.5 7.5 0 0 1 15 0` },
  { to: '/usuarios', label: 'Usuarios', icon: `${circle(9, 8, 3.5)}M2.5 20a6.5 6.5 0 0 1 13 0${circle(17, 9, 2.5)}M17 14a4.5 4.5 0 0 1 4.5 5` },
  { to: '/auditoria', label: 'Auditoría', icon: 'M7 4.5H5.5v16h13v-16H17M9 3h6v3H9zM9 11h6M9 15h6M9 19h3' },
  { to: '/empresa', label: 'Mi empresa', icon: 'M4 21V5.5L12 3v18M12 9h8v12M2.5 21h19M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2' },
  { to: '/sunat', label: 'SUNAT', icon: 'M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4' },
  { to: '/series', label: 'Series', icon: 'M5 9h14M5 15h14M10.5 3.5 8.5 20.5M15.5 3.5l-2 17' },
]

/**
 * Activa por prefijo de ruta: «Ventas» sigue marcada en /ventas/comprobantes
 * y en los detalles, que son rutas hermanas y no anidadas.
 */
function isActive(item: Item): boolean {
  return item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(`${item.to}/`)
}
</script>

<template>
  <nav aria-label="Principal" class="space-y-6">
    <ul class="space-y-1">
      <li v-for="item in primary" :key="item.to">
        <RouterLink
          :to="item.to"
          class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition"
          :class="isActive(item) ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-subtle hover:text-ink'"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-5 shrink-0">
            <path :d="item.icon" />
          </svg>
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>

    <div v-if="session.isCompanyAdmin">
      <p id="nav-admin" class="px-3 pb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">Gestión</p>
      <ul aria-labelledby="nav-admin" class="space-y-1">
        <li v-for="item in admin" :key="item.to">
          <RouterLink
            :to="item.to"
            class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition"
            :class="isActive(item) ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-subtle hover:text-ink'"
            :aria-current="isActive(item) ? 'page' : undefined"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-5 shrink-0">
              <path :d="item.icon" />
            </svg>
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>
