<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import { useSessionStore } from '@/core/auth/session-store'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { authFeatureApi } from '../api'
import type { PublicInvitation } from '../types'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const token = String(route.params.token)

const invitation = ref<PublicInvitation | null>(null)
const loadError = ref<string | null>(null)
const loading = ref(true)

const { submitting, generalError, fieldError, submit } = useApiForm()
const name = ref('')
const password = ref('')
const passwordConfirmation = ref('')

onMounted(async () => {
  try {
    invitation.value = await authFeatureApi.getInvitation(token)
  } catch (error) {
    loadError.value =
      error instanceof ApiError && error.status === 404
        ? 'Este enlace de invitación no existe. Revisa que esté completo.'
        : error instanceof ApiError
          ? error.message
          : 'No se pudo cargar la invitación.'
  } finally {
    loading.value = false
  }
})

async function onSubmit() {
  const ok = await submit(() =>
    session.acceptInvitation(token, {
      name: name.value,
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    }),
  )

  if (ok) await router.replace({ name: 'home' })
}
</script>

<template>
  <h1 class="text-xl font-semibold">Activa tu cuenta</h1>

  <p v-if="loading" class="mt-6 text-sm text-ink-muted">Cargando invitación…</p>

  <BaseAlert v-else-if="loadError" variant="error" class="mt-6">{{ loadError }}</BaseAlert>

  <template v-else-if="invitation">
    <p class="mt-1 text-sm text-ink-muted">
      Te invitaron a <strong class="text-ink">{{ invitation.company.nombre_comercial ?? invitation.company.razon_social }}</strong>
      como {{ invitation.role_label.toLowerCase() }}.
    </p>

    <form class="mt-6 space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseAlert v-if="generalError || fieldError('email')" variant="error">{{ fieldError('email') ?? generalError }}</BaseAlert>

      <FormField label="Correo" for="email">
        <BaseInput id="email" :model-value="invitation.email" type="email" disabled />
      </FormField>

      <FormField v-slot="{ describedBy, invalid }" label="Tu nombre" for="name" :error="fieldError('name')">
        <BaseInput id="name" v-model="name" autocomplete="name" required :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>

      <FormField
        v-slot="{ describedBy, invalid }"
        label="Contraseña"
        for="password"
        hint="Mínimo 10 caracteres, con letras y números."
        :error="fieldError('password')"
      >
        <BaseInput
          id="password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          required
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <FormField v-slot="{ describedBy }" label="Repite la contraseña" for="password_confirmation">
        <BaseInput
          id="password_confirmation"
          v-model="passwordConfirmation"
          type="password"
          autocomplete="new-password"
          required
          :aria-describedby="describedBy"
        />
      </FormField>

      <BaseButton type="submit" block :loading="submitting">Activar cuenta</BaseButton>
    </form>
  </template>
</template>
