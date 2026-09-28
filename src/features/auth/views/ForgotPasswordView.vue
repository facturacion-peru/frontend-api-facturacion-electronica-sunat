<script setup lang="ts">
import { ref } from 'vue'

import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { authFeatureApi } from '../api'

const { submitting, generalError, fieldError, submit } = useApiForm()
const email = ref('')
const sentMessage = ref<string | null>(null)

async function onSubmit() {
  await submit(async () => {
    sentMessage.value = (await authFeatureApi.forgotPassword(email.value)).message
  })
}
</script>

<template>
  <h1 class="text-xl font-semibold">Recuperar contraseña</h1>
  <p class="mt-1 text-sm text-ink-muted">Te enviaremos un enlace para crear una nueva.</p>

  <BaseAlert v-if="sentMessage" variant="success" class="mt-6">{{ sentMessage }}</BaseAlert>

  <form v-else class="mt-6 space-y-4" novalidate @submit.prevent="onSubmit">
    <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>

    <FormField v-slot="{ describedBy, invalid }" label="Correo" for="email" :error="fieldError('email')">
      <BaseInput
        id="email"
        v-model="email"
        type="email"
        autocomplete="email"
        inputmode="email"
        required
        :invalid="invalid"
        :aria-describedby="describedBy"
      />
    </FormField>

    <BaseButton type="submit" block :loading="submitting">Enviar enlace</BaseButton>
  </form>

  <p class="mt-4 text-center text-sm">
    <RouterLink :to="{ name: 'login' }" class="text-brand-700 hover:underline">Volver a iniciar sesión</RouterLink>
  </p>
</template>
