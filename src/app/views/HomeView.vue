<script setup lang="ts">
import { computed } from 'vue'

import { useSessionStore } from '@/core/auth/session-store'

const session = useSessionStore()
const firstName = computed(() => session.session?.user.name.split(' ')[0] ?? '')
const company = computed(() => session.session?.company?.nombre_comercial ?? session.session?.company?.razon_social)
</script>

<template>
  <h1 class="text-xl font-semibold">Hola, {{ firstName }}</h1>
  <p class="mt-1 text-ink-muted">Estás trabajando en {{ company }}.</p>

  <div v-if="session.isCompanyAdmin" class="mt-6 grid gap-3 sm:grid-cols-3">
    <RouterLink to="/usuarios" class="rounded-xl border border-line bg-surface p-4 hover:border-brand-600">
      <p class="font-medium">Usuarios</p>
      <p class="text-sm text-ink-muted">Invita a tu equipo y gestiona sus roles.</p>
    </RouterLink>
    <RouterLink to="/empresa" class="rounded-xl border border-line bg-surface p-4 hover:border-brand-600">
      <p class="font-medium">Mi empresa</p>
      <p class="text-sm text-ink-muted">Datos de contacto y logo.</p>
    </RouterLink>
    <RouterLink to="/auditoria" class="rounded-xl border border-line bg-surface p-4 hover:border-brand-600">
      <p class="font-medium">Auditoría</p>
      <p class="text-sm text-ink-muted">Quién hizo qué y cuándo.</p>
    </RouterLink>
  </div>
  <p v-else class="mt-6 text-sm text-ink-muted">Las ventas y los comprobantes llegarán en las próximas versiones.</p>
</template>
