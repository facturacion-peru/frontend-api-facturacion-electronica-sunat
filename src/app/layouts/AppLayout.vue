<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'
import type { CompanyRole } from '@/core/auth/types'
import BaseBadge from '@/shared/ui/BaseBadge.vue'

const session = useSessionStore()
const router = useRouter()

interface NavItem {
  to: string
  label: string
  roles?: CompanyRole[]
}

const items: NavItem[] = [
  { to: '/', label: 'Inicio' },
  { to: '/empresa', label: 'Mi empresa', roles: ['company_admin'] },
  { to: '/usuarios', label: 'Usuarios', roles: ['company_admin'] },
  { to: '/auditoria', label: 'Auditoría', roles: ['company_admin'] },
]

const visibleItems = computed(() =>
  items.filter((item) => !item.roles || (session.role !== null && item.roles.includes(session.role))),
)

const companyName = computed(
  () => session.session?.company?.nombre_comercial ?? session.session?.company?.razon_social ?? '',
)
const roleLabel = computed(() => (session.role === 'company_admin' ? 'Administrador' : 'Vendedor'))

async function logout() {
  await session.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-dvh">
    <header class="border-b border-line bg-surface">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="truncate font-semibold text-ink">{{ companyName }}</p>
          <p class="flex items-center gap-2 text-xs text-ink-muted">
            <span class="truncate">{{ session.session?.user.name }}</span>
            <BaseBadge variant="info">{{ roleLabel }}</BaseBadge>
          </p>
        </div>
        <button
          type="button"
          class="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-canvas"
          @click="logout"
        >
          Cerrar sesión
        </button>
      </div>
      <nav aria-label="Principal" class="mx-auto max-w-5xl overflow-x-auto px-2">
        <ul class="flex gap-1">
          <li v-for="item in visibleItems" :key="item.to">
            <RouterLink
              :to="item.to"
              class="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-ink-muted"
              exact-active-class="!border-brand-600 !text-brand-700 font-medium"
            >
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
