<script setup lang="ts">
import { onKeyStroke, useMediaQuery, useScrollLock } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'
import { device } from '@/core/device'
import { useSaleDraftStore } from '@/features/sales/stores/sale-draft'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import LogoApp from '@/shared/ui/LogoApp.vue'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
import { useDismissable } from '@/shared/ui/dismissable'
import MainNav from './MainNav.vue'

/**
 * Layout de la aplicación de empresa (spec 010, HU-6). Desde `lg` la
 * navegación vive en una barra lateral fija, contraíble a íconos (v1.4), y
 * el contenido aprovecha toda la altura; las rutas con `meta.fullWidth`
 * («Vender») usan también todo el ancho. En el celular, una barra superior mínima abre la misma barra
 * lateral como panel: inerte mientras está cerrado, se cierra con Escape, con
 * el velo o al navegar, y devuelve el foco al botón de menú.
 */
const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const companyName = computed(
  () => session.session?.company?.nombre_comercial ?? session.session?.company?.razon_social ?? '',
)
const roleLabel = computed(() => (session.role === 'company_admin' ? 'Administrador' : 'Vendedor'))

const isDesktop = useMediaQuery('(min-width: 1024px)')
const open = ref(false)
const fullWidth = computed(() => Boolean(route.meta.fullWidth))

/** Barra contraída a íconos en escritorio (spec 010 v1.4), recordado en el dispositivo. */
const COLLAPSED_KEY = 'sunat.sidebar.collapsed'
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}
const collapsed = ref(readCollapsed())
watch(collapsed, (value) => {
  try {
    if (value) localStorage.setItem(COLLAPSED_KEY, '1')
    else localStorage.removeItem(COLLAPSED_KEY)
  } catch {
    // Sin almacenamiento dura hasta recargar.
  }
})
const toggle = useTemplateRef<HTMLButtonElement>('toggle')
const sidebar = useTemplateRef<HTMLElement>('sidebar')
const scrollLock = useScrollLock(typeof document === 'undefined' ? null : document.body)

watch([open, isDesktop], ([isOpen, desktop]) => {
  scrollLock.value = isOpen && !desktop
})

async function openPanel() {
  open.value = true
  await nextTick()
  sidebar.value?.focus()
}

async function closePanel({ restoreFocus = true } = {}) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) {
    await nextTick()
    toggle.value?.focus()
  }
}

onKeyStroke('Escape', () => closePanel())
// En Android, «Atrás» también lo cierra (spec 013).
useDismissable(() => open.value, () => void closePanel())

// Al navegar, el foco lo maneja la nueva pantalla.
watch(
  () => route.fullPath,
  () => closePanel({ restoreFocus: false }),
)

/** Sin conexión se avisa; la venta en curso queda guardada (spec 013, HU-4). */
const online = ref(true)
onBeforeUnmount(device().onConnectionChange((value) => (online.value = value)))

async function logout() {
  // La venta en curso es del usuario: se borra al salir (spec 012, RF-003),
  // antes de perder la sesión que da su clave. Un 401 no pasa por aquí.
  useSaleDraftStore().clear()
  await session.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-dvh lg:flex">
    <!-- Celular: barra superior mínima. -->
    <header class="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b border-line bg-surface/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <button
        ref="toggle"
        type="button"
        class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink"
        aria-controls="app-sidebar"
        :aria-expanded="open"
        aria-label="Menú"
        @click="open ? closePanel() : openPanel()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" class="size-6">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <RouterLink to="/" class="flex min-w-0 items-center gap-2 rounded-lg">
        <LogoApp :size="30" />
        <span class="truncate font-semibold text-ink">{{ companyName }}</span>
      </RouterLink>
    </header>

    <div
      v-if="open && !isDesktop"
      data-test="sidebar-backdrop"
      class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      aria-hidden="true"
      @click="closePanel()"
    />

    <aside
      id="app-sidebar"
      ref="sidebar"
      tabindex="-1"
      aria-label="Navegación"
      :inert="(!isDesktop && !open) || undefined"
      :data-collapsed="collapsed || undefined"
      class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-line bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-[translate,width] duration-200 focus:outline-none lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:max-w-none lg:translate-x-0"
      :class="[open ? 'translate-x-0 shadow-xl' : '-translate-x-full', collapsed ? 'lg:w-18' : 'lg:w-64']"
    >
      <div class="flex items-center gap-3 border-b border-line px-4 py-4" :class="collapsed && 'lg:flex-col lg:gap-2 lg:px-0'">
        <RouterLink to="/" class="shrink-0 rounded-xl"><LogoApp :size="40" /></RouterLink>
        <div class="min-w-0 flex-1" :class="collapsed && 'lg:hidden'">
          <p class="truncate font-semibold text-ink">{{ companyName }}</p>
          <p class="truncate text-xs text-ink-muted">Facturación electrónica</p>
        </div>
        <button
          type="button"
          class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink lg:hidden"
          aria-label="Cerrar menú"
          @click="closePanel()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" class="size-5">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <button
          type="button"
          data-test="sidebar-collapse"
          class="hidden size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-subtle hover:text-ink lg:inline-flex"
          :aria-label="collapsed ? 'Expandir menú' : 'Contraer menú'"
          :title="collapsed ? 'Expandir menú' : 'Contraer menú'"
          :aria-pressed="collapsed"
          @click="collapsed = !collapsed"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-5">
            <path d="M4 4h16v16H4zM9 4v16" />
            <path :d="collapsed ? 'M13 10l2 2-2 2' : 'M15 10l-2 2 2 2'" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
        <MainNav :collapsed="collapsed" />
      </div>

      <div class="flex items-center gap-1 border-t border-line px-3 py-3" :class="collapsed && 'lg:flex-col lg:px-0'">
        <span
          class="ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
          :class="collapsed && 'lg:hidden'"
          aria-hidden="true"
        >
          {{ session.session?.user.name.charAt(0) }}
        </span>
        <div class="ml-2 min-w-0 flex-1" :class="collapsed && 'lg:hidden'">
          <p class="truncate text-sm font-medium text-ink">{{ session.session?.user.name }}</p>
          <BaseBadge variant="info">{{ roleLabel }}</BaseBadge>
        </div>
        <ThemeToggle class="text-ink-muted hover:text-ink" />
        <button
          type="button"
          :title="`Cerrar sesión (${session.session?.user.name ?? ''})`"
          class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-subtle hover:text-ink"
          @click="logout"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">
            <path fill-rule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .41.34.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clip-rule="evenodd" />
            <path fill-rule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.7l1.03-1.03a.75.75 0 0 0-1.06-1.06l-2.5 2.5a.75.75 0 0 0 0 1.06l2.5 2.5a.75.75 0 1 0 1.06-1.06L8.7 10.75h9.55A.75.75 0 0 0 19 10Z" clip-rule="evenodd" />
          </svg>
          <span class="sr-only">Cerrar sesión</span>
        </button>
      </div>
    </aside>

    <main class="min-w-0 flex-1">
      <p
        v-if="!online"
        data-test="offline"
        role="status"
        class="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-warning-200 bg-warning-50 px-4 py-2 text-center text-sm font-medium text-warning-700 lg:top-0"
      >
        Sin conexión. Revisa tus datos o el Wi-Fi; la venta en curso se conserva.
      </p>
      <!-- «Vender» y otras pantallas de trabajo usan todo el ancho y, en escritorio, todo el alto. -->
      <div v-if="fullWidth" class="px-4 py-4 lg:flex lg:h-dvh lg:flex-col lg:px-6 lg:py-5">
        <RouterView />
      </div>
      <div v-else class="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
