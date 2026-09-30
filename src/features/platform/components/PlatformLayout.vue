<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'

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
    <header class="border-b border-line bg-slate-900 text-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="font-semibold">Plataforma</p>
          <p class="truncate text-xs text-slate-300">{{ session.session?.user.name }}</p>
        </div>
        <button type="button" class="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-slate-200 hover:bg-slate-800" @click="logout">
          Cerrar sesión
        </button>
      </div>
      <nav aria-label="Plataforma" class="mx-auto max-w-5xl px-2">
        <ul class="flex gap-1">
          <li v-for="link in links" :key="link.label">
            <RouterLink
              :to="link.to"
              class="inline-flex min-h-11 items-center border-b-2 px-3 text-sm"
              :class="isActive(link.prefix) ? 'border-white font-medium text-white' : 'border-transparent text-slate-300'"
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
