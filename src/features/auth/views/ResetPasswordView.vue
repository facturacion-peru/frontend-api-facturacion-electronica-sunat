<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { authFeatureApi } from '../api'

const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))

const { submitting, generalError, fieldError, submit } = useApiForm()
const password = ref('')
const passwordConfirmation = ref('')
const done = ref(false)

async function onSubmit() {
  done.value = await submit(() =>
    authFeatureApi.resetPassword({
      token: token.value,
      email: email.value,
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    }),
  )
}
</script>

<template>
  <h1 class="text-xl font-semibold">Nueva contraseña</h1>

  <BaseAlert v-if="!token || !email" variant="error" class="mt-6">
    El enlace está incompleto. Pide uno nuevo desde «¿Olvidaste tu contraseña?».
  </BaseAlert>

  <template v-else-if="done">
    <BaseAlert variant="success" class="mt-6">Contraseña actualizada. Ya puedes iniciar sesión.</BaseAlert>
    <RouterLink :to="{ name: 'login' }" class="mt-4 block text-center text-sm text-brand-700 hover:underline">
      Iniciar sesión
    </RouterLink>
  </template>

  <form v-else class="mt-6 space-y-4" novalidate @submit.prevent="onSubmit">
    <p class="text-sm text-ink-muted">Para {{ email }}</p>
    <BaseAlert v-if="generalError || fieldError('token')" variant="error">
      {{ fieldError('token') ?? generalError }}
      <RouterLink v-if="fieldError('token')" :to="{ name: 'forgot-password' }" class="underline">Pedir otro enlace</RouterLink>
    </BaseAlert>

    <FormField
      v-slot="{ describedBy, invalid }"
      label="Nueva contraseña"
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

    <BaseButton type="submit" block :loading="submitting">Guardar contraseña</BaseButton>
  </form>
</template>
