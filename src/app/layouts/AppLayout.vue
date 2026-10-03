<script setup lang="ts">
import { onKeyStroke, useMediaQuery, useScrollLock } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import LogoApp from '@/shared/ui/LogoApp.vue'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'
import MainNav from './MainNav.vue'

/**
 * Layout de la aplicación de empresa (spec 010, HU-6). Desde `lg` la
 * navegación vive en una barra lateral fija y el contenido aprovecha toda la
 * altura. En el celular, una barra superior mínima abre la misma barra
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

// Al navegar, el foco lo maneja la nueva pantalla.
watch(
  () => route.fullPath,
  () => closePanel({ restoreFocus: false }),
)

async function logout() {
  await session.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-dvh lg:flex">
    <!-- Celular: barra superior mínima. -->
    <header class="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-2 backdrop-blur lg:hidden">
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
      class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface transition-transform duration-200 focus:outline-none lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-64 lg:max-w-none lg:translate-x-0"
      :class="open ? 'translate-x-0 shadow-xl' : '-translate-x-full'"
    >
      <div class="flex items-center gap-3 border-b border-line px-4 py-4">
        <RouterLink to="/" class="shrink-0 rounded-xl"><LogoApp :size="40" /></RouterLink>
        <div class="min-w-0 flex-1">
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
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-4">
        <MainNav />
      </div>

      <div class="flex items-center gap-1 border-t border-line px-3 py-3">
        <span
          class="ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
          aria-hidden="true"
        >
          {{ session.session?.user.name.charAt(0) }}
        </span>
        <div class="ml-2 min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-ink">{{ session.session?.user.name }}</p>
          <BaseBadge variant="info">{{ roleLabel }}</BaseBadge>
        </div>
        <ThemeToggle class="text-ink-muted hover:text-ink" />
        <button
          type="button"
          title="Cerrar sesión"
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
      <div class="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
