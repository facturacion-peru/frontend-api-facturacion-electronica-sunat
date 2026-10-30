<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { CompanyRole } from '@/core/auth/types'
import { useApiForm } from '@/shared/composables/useApiForm'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { usersApi } from '../api'
import { roleLabels } from '../types'
import EstablishmentChecklist from './EstablishmentChecklist.vue'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ invited: [] }>()

const { submitting, generalError, fieldError, fieldErrors, reset, submit } = useApiForm()
const establishments = useEstablishmentStore()
const email = ref('')
const role = ref<CompanyRole>('seller')
const establishmentIds = ref<number[]>([])

// Con un solo local no se piden: la API asigna ese al aceptar (spec 017).
const asksEstablishments = computed(() => role.value === 'seller' && establishments.multi)

watch(open, (isOpen) => {
  if (isOpen) {
    email.value = ''
    role.value = 'seller'
    establishmentIds.value = establishments.current ? [establishments.current.id] : []
    reset()
  }
})

async function onSubmit() {
  const ids = asksEstablishments.value ? establishmentIds.value : undefined
  if (await submit(() => usersApi.invite(email.value, role.value, ids))) {
    open.value = false
    emit('invited')
  }
}
</script>

<template>
  <BaseDialog v-model:open="open" title="Invitar usuario">
    <form id="invite-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>

      <FormField v-slot="{ describedBy, invalid }" label="Correo" for="invite-email" :error="fieldError('email')">
        <BaseInput
          id="invite-email"
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="off"
          required
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <fieldset>
        <legend class="text-sm font-medium text-ink">Rol</legend>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          <label
            v-for="(label, value) in roleLabels"
            :key="value"
            class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"
          >
            <input v-model="role" type="radio" name="invite-role" :value="value" />
            {{ label }}
          </label>
        </div>
        <p v-if="fieldError('role')" class="mt-1 text-xs text-danger-700">{{ fieldError('role') }}</p>
      </fieldset>

      <EstablishmentChecklist v-if="asksEstablishments" v-model="establishmentIds" name="invite-establishments" :errors="fieldErrors" />
    </form>

    <template #actions>
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="invite-form" :loading="submitting">Enviar invitación</BaseButton>
    </template>
  </BaseDialog>
</template>
