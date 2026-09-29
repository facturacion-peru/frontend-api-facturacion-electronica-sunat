<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'

/**
 * Navegación principal. Lo del día a día queda a la vista (Inicio, Vender,
 * Ventas, Productos); la gestión del administrador va en «Más», para que
 * todo quepa a 360 px (observación de la verificación de la spec 002).
 */
const session = useSessionStore()
const route = useRoute()

const primary = [
  { to: '/', label: 'Inicio', exact: true },
  { to: '/vender', label: 'Vender', exact: false },
  { to: '/ventas', label: 'Ventas', exact: false },
  { to: '/productos', label: 'Productos', exact: false },
]

const more = [
  { to: '/inventario/alertas', label: 'Alertas' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/auditoria', label: 'Auditoría' },
  { to: '/empresa', label: 'Mi empresa' },
  { to: '/sunat', label: 'SUNAT' },
  { to: '/series', label: 'Series' },
]

const open = ref(false)
const container = useTemplateRef<HTMLElement>('container')
const toggle = useTemplateRef<HTMLButtonElement>('toggle')
const moreActive = computed(() => more.some((item) => route.path.startsWith(item.to)))

onClickOutside(container, () => {
  open.value = false
})

watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)

async function close() {
  open.value = false
  await nextTick()
  toggle.value?.focus()
}
</script>

<template>
  <nav aria-label="Principal" class="mx-auto max-w-5xl px-2">
    <ul class="flex items-center gap-1">
      <li v-for="item in primary" :key="item.to">
        <RouterLink
          :to="item.to"
          class="inline-flex min-h-11 items-center border-b-2 border-transparent px-2.5 text-sm whitespace-nowrap text-ink-muted sm:px-3"
          :active-class="item.exact ? '' : '!border-brand-600 !text-brand-700 font-medium'"
          :exact-active-class="item.exact ? '!border-brand-600 !text-brand-700 font-medium' : ''"
        >
          {{ item.label }}
        </RouterLink>
      </li>
      <li v-if="session.isCompanyAdmin" ref="container" class="relative ml-auto" @keydown.escape="close">
        <button
          ref="toggle"
          type="button"
          class="inline-flex min-h-11 items-center gap-1 border-b-2 px-2.5 text-sm whitespace-nowrap sm:px-3"
          :class="moreActive ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-ink-muted'"
          :aria-expanded="open"
          aria-controls="nav-more"
          @click="open = !open"
        >
          Más <span aria-hidden="true">▾</span>
        </button>
        <ul
          v-show="open"
          id="nav-more"
          class="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          <li v-for="item in more" :key="item.to">
            <RouterLink
              :to="item.to"
              class="flex min-h-11 items-center px-4 text-sm text-ink hover:bg-canvas"
              active-class="font-medium text-brand-700"
            >
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
