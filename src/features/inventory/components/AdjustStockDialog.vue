<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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
import type { AdjustmentReason, Lot } from '../types'

const props = defineProps<{ lot: Lot | null; allowsDecimals: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [] }>()

const { catalogs } = useInventoryCatalogs()
const { submitting, generalError, fieldError, reset, submit } = useApiForm()
const direction = ref<'+' | '-'>('-')
const quantity = ref('')
const reason = ref<AdjustmentReason>('count')
const note = ref('')

const title = computed(() => (props.lot ? `Ajustar lote ${props.lot.lot_number}` : 'Ajustar lote'))

watch(open, (isOpen) => {
  if (isOpen) {
    direction.value = '-'
    quantity.value = ''
    reason.value = 'count'
    note.value = ''
    reset()
  }
})

async function onSubmit() {
  const ok = await submit(() =>
    inventoryApi.adjust(props.lot!.id, {
      quantity: `${direction.value === '-' ? '-' : ''}${quantity.value}`,
      reason: reason.value,
      ...(note.value && { note: note.value }),
    }),
  )

  if (ok) {
    open.value = false
    emit('done')
  }
}
</script>

<template>
  <BaseDialog v-model:open="open" :title="title">
    <form id="adjust-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <p v-if="lot" class="text-sm text-ink-muted">Saldo actual: {{ formatQuantity(lot.remaining_quantity) }}</p>
      <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>

      <fieldset>
        <legend class="text-sm font-medium">Tipo de ajuste</legend>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <label class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm has-checked:border-brand-600 has-checked:bg-brand-50">
            <input v-model="direction" type="radio" name="adjust-direction" value="-" /> Restar
          </label>
          <label class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm has-checked:border-brand-600 has-checked:bg-brand-50">
            <input v-model="direction" type="radio" name="adjust-direction" value="+" /> Sumar
          </label>
        </div>
      </fieldset>

      <FormField v-slot="{ describedBy, invalid }" label="Cantidad" for="adjust-quantity" :error="fieldError('quantity')">
        <BaseInput
          id="adjust-quantity"
          v-model="quantity"
          :inputmode="allowsDecimals ? 'decimal' : 'numeric'"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <FormField label="Motivo" for="adjust-reason" :error="fieldError('reason')">
        <BaseSelect id="adjust-reason" v-model="reason">
          <option v-for="item in catalogs?.adjustment_reasons ?? []" :key="item.code" :value="item.code">{{ item.label }}</option>
        </BaseSelect>
      </FormField>

      <FormField v-slot="{ describedBy }" label="Nota (opcional)" for="adjust-note" :error="fieldError('note')">
        <BaseInput id="adjust-note" v-model="note" :aria-describedby="describedBy" />
      </FormField>
    </form>

    <template #actions>
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="adjust-form" :loading="submitting">Guardar ajuste</BaseButton>
    </template>
  </BaseDialog>
</template>
