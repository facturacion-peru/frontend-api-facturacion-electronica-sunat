<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'

const session = useSessionStore()
const router = useRouter()

async function logout() {
  await session.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
    <BaseAlert variant="info" title="Esta aplicación es para las empresas">
      Tu cuenta es de administrador de la plataforma. Gestiona las empresas desde la consola
      (<code>php artisan company:create</code>) hasta que esté disponible el panel de la plataforma.
    </BaseAlert>
    <BaseButton variant="secondary" @click="logout">Cerrar sesión</BaseButton>
  </div>
</template>
