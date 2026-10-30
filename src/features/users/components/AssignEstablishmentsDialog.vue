<script setup lang="ts">
/** Locales de un vendedor (spec 017, A-87): `PUT /users/{user}/establishments`. */
import { ref, watch } from 'vue'

import { useApiForm } from '@/shared/composables/useApiForm'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { usersApi } from '../api'
import type { CompanyUser } from '../types'
import EstablishmentChecklist from './EstablishmentChecklist.vue'

const props = defineProps<{ user: CompanyUser | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [user: CompanyUser] }>()

const store = useEstablishmentStore()
const { submitting, generalError, fieldErrors, reset, submit } = useApiForm()
const selected = ref<number[]>([])

watch(open, (isOpen) => {
  if (!isOpen || !props.user) return
  reset()
  // Solo se ofrecen los activos: uno desactivado se quita al guardar.
  selected.value = (props.user.establishment_ids ?? []).filter((id) => store.allowed.some((e) => e.id === id))
})

async function onSubmit() {
  const user = props.user!
  let saved: CompanyUser | null = null
  if (await submit(async () => (saved = await usersApi.assignEstablishments(user.id, selected.value)))) {
    open.value = false
    emit('saved', saved!)
  }
}
</script>

<template>
  <BaseDialog v-model:open="open" :title="`Locales de ${user?.name ?? ''}`">
    <form id="assign-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>
      <EstablishmentChecklist v-model="selected" name="assign-establishments" :errors="fieldErrors" />
    </form>
    <template #actions>
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="assign-form" :loading="submitting" data-test="save-establishments">Guardar</BaseButton>
    </template>
  </BaseDialog>
</template>
