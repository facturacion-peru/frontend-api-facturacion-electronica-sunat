<script setup lang="ts">
import { ref, watch } from 'vue'

import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatQuantity } from '@/shared/utils/format'
import { inventoryApi } from '../api'
import { useInventoryCatalogs } from '../composables/useInventoryCatalogs'
import { movementLabels, type AdjustmentReason, type Movement } from '../types'

const props = defineProps<{ movement: Movement | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [] }>()

const { catalogs } = useInventoryCatalogs()
const { submitting, generalError, fieldError, reset, submit } = useApiForm()
const reason = ref<AdjustmentReason>('error')
const note = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    reason.value = 'error'
    note.value = ''
    reset()
  }
})

async function onSubmit() {
  const ok = await submit(() =>
    inventoryApi.reverse(props.movement!.id, { reason: reason.value, ...(note.value && { note: note.value }) }),
  )

  if (ok) {
    open.value = false
    emit('done')
  }
}
</script>

<template>
  <BaseDialog v-model:open="open" title="Revertir movimiento">
    <form id="reverse-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <p v-if="movement" class="text-sm text-ink-muted">
        {{ movementLabels[movement.type] }} de {{ formatQuantity(movement.quantity) }} en el lote {{ movement.lot.lot_number }}.
        Se registrará un movimiento inverso; el original se conserva.
      </p>
      <BaseAlert v-if="generalError || fieldError('movement')" variant="error">{{ fieldError('movement') ?? generalError }}</BaseAlert>

      <FormField label="Motivo" for="reverse-reason" :error="fieldError('reason')">
        <BaseSelect id="reverse-reason" v-model="reason">
          <option v-for="item in catalogs?.adjustment_reasons ?? []" :key="item.code" :value="item.code">{{ item.label }}</option>
        </BaseSelect>
      </FormField>

      <FormField v-slot="{ describedBy }" label="Nota (opcional)" for="reverse-note" :error="fieldError('note')">
        <BaseInput id="reverse-note" v-model="note" :aria-describedby="describedBy" />
      </FormField>
    </form>

    <template #actions>
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="reverse-form" variant="danger" :loading="submitting">Revertir</BaseButton>
    </template>
  </BaseDialog>
</template>
