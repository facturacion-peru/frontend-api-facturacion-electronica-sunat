<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { safeRedirect } from '@/core/auth/guards'
import { useSessionStore } from '@/core/auth/session-store'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const { submitting, generalError, fieldError, submit } = useApiForm()

const email = ref('')
const password = ref('')

async function onSubmit() {
  const ok = await submit(() => session.login(email.value, password.value))

  if (ok) {
    await router.replace(safeRedirect(route.query.redirect))
  }
}
</script>

<template>
  <h1 class="text-xl font-semibold">Iniciar sesión</h1>
  <p v-if="route.query.redirect" class="mt-1 text-sm text-ink-muted">Tu sesión terminó. Vuelve a entrar para continuar.</p>

  <form class="mt-6 space-y-4" novalidate @submit.prevent="onSubmit">
    <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>

    <FormField v-slot="{ describedBy, invalid }" label="Correo" for="email" :error="fieldError('email')">
      <BaseInput
        id="email"
        v-model="email"
        type="email"
        autocomplete="username"
        inputmode="email"
        required
        :invalid="invalid"
        :aria-describedby="describedBy"
      />
    </FormField>

    <FormField v-slot="{ describedBy, invalid }" label="Contraseña" for="password" :error="fieldError('password')">
      <BaseInput
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        :invalid="invalid"
        :aria-describedby="describedBy"
      />
    </FormField>

    <BaseButton type="submit" block :loading="submitting">Entrar</BaseButton>
  </form>

  <p class="mt-4 text-center text-sm">
    <RouterLink :to="{ name: 'forgot-password' }" class="text-brand-700 hover:underline">¿Olvidaste tu contraseña?</RouterLink>
  </p>
</template>
