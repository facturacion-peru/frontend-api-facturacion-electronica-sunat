<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'
import LogoApp from '@/shared/ui/LogoApp.vue'
import ThemeToggle from '@/shared/ui/ThemeToggle.vue'

/** Layout del panel de la plataforma (A-35): separado del de las empresas. */
const session = useSessionStore()
const router = useRouter()

const links = [
  { to: { name: 'platform-companies' }, label: 'Empresas', prefix: ['/plataforma', '/plataforma/empresas'] },
  { to: { name: 'platform-support' }, label: 'Soporte', prefix: ['/plataforma/soporte'] },
  { to: { name: 'platform-audit' }, label: 'Auditoría', prefix: ['/plataforma/auditoria'] },
]

function isActive(prefixes: string[]): boolean {
  const path = router.currentRoute.value.path
  if (prefixes[0] === '/plataforma') return path === '/plataforma' || path.startsWith('/plataforma/empresas')

  return prefixes.some((p) => path === p || path.startsWith(`${p}/`))
}

async function logout() {
  await session.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-dvh">
    <header class="bg-brand-950 text-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div class="flex min-w-0 items-center gap-3">
          <LogoApp :size="36" />
          <div class="min-w-0">
            <p class="font-semibold">Plataforma</p>
            <p class="truncate text-xs text-white/70">{{ session.session?.user.name }}</p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <ThemeToggle class="text-white/85" />
          <button
            type="button"
            class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-white/85 hover:bg-white/10 sm:px-3"
            @click="logout"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5 sm:hidden">
              <path fill-rule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .41.34.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clip-rule="evenodd" />
              <path fill-rule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.7l1.03-1.03a.75.75 0 0 0-1.06-1.06l-2.5 2.5a.75.75 0 0 0 0 1.06l2.5 2.5a.75.75 0 1 0 1.06-1.06L8.7 10.75h9.55A.75.75 0 0 0 19 10Z" clip-rule="evenodd" />
            </svg>
            <span class="sr-only sm:not-sr-only">Cerrar sesión</span>
          </button>
        </div>
      </div>
      <nav aria-label="Plataforma" class="mx-auto max-w-5xl px-2">
        <ul class="flex gap-1">
          <li v-for="link in links" :key="link.label">
            <RouterLink
              :to="link.to"
              class="inline-flex min-h-11 items-center border-b-2 px-3 text-sm"
              :class="isActive(link.prefix) ? 'border-white font-medium text-white' : 'border-transparent text-white/70 hover:text-white'"
              :aria-current="isActive(link.prefix) ? 'page' : undefined"
            >
              {{ link.label }}
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
