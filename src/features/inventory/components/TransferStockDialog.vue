<script setup lang="ts">
/**
 * Trasladar mercadería de un local a otro (spec 017, HU-3). La API saca FEFO
 * del origen y entra al destino en una sola operación: con stock
 * insuficiente no cambia nada y el mensaje llega en `quantity`. Se puede
 * sacar de un local inactivo (vaciarlo), pero no mandar a uno.
 */
import { computed, ref, watch } from 'vue'

import { useApiForm } from '@/shared/composables/useApiForm'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatQuantity } from '@/shared/utils/format'
import { inventoryApi } from '../api'
import type { Product } from '../types'

const props = defineProps<{ product: Product; allowsDecimals: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [product: Product] }>()

const store = useEstablishmentStore()
const { submitting, generalError, fieldError, reset, submit } = useApiForm()
const fromId = ref<number | null>(null)
const toId = ref<number | null>(null)
const quantity = ref('')
const note = ref('')

/** Locales con algo disponible para sacar, también inactivos. */
const origins = computed(() =>
  (props.product.stock_by_establishment ?? [])
    .filter((s) => Number(s.available_stock) > 0)
    .map((s) => ({ id: s.establishment_id, name: store.find(s.establishment_id)?.name ?? `Local ${s.establishment_id}`, available: s.available_stock })),
)
const destinations = computed(() => store.allowed.filter((e) => e.id !== fromId.value))

watch(open, (isOpen) => {
  if (!isOpen) return
  reset()
  quantity.value = ''
  note.value = ''
  fromId.value = origins.value.find((o) => o.id === store.current?.id)?.id ?? origins.value[0]?.id ?? null
})

// El destino nunca es el origen.
watch(
  [fromId, open],
  () => {
    if (!destinations.value.some((e) => e.id === toId.value)) toId.value = destinations.value[0]?.id ?? null
  },
  { immediate: true },
)

async function onSubmit() {
  let updated: Product | null = null
  const ok = await submit(async () => {
    updated = await inventoryApi.transfer(props.product.id, {
      from_establishment_id: fromId.value!,
      to_establishment_id: toId.value!,
      quantity: quantity.value,
      ...(note.value && { note: note.value }),
    })
  })
  if (ok) {
    open.value = false
    emit('done', updated!)
  }
}
</script>

<template>
  <BaseDialog v-model:open="open" :title="`Trasladar ${product.name}`">
    <p v-if="origins.length === 0" class="text-sm text-ink-muted" data-test="no-stock">No hay stock disponible para trasladar.</p>

    <form v-else id="transfer-form" class="space-y-4" novalidate @submit.prevent="onSubmit">
      <BaseAlert v-if="generalError || fieldError('product')" variant="error">{{ fieldError('product') ?? generalError }}</BaseAlert>

      <FormField v-slot="{ describedBy, invalid }" label="Desde" for="transfer-from" :error="fieldError('from_establishment_id')">
        <BaseSelect id="transfer-from" v-model="fromId" :invalid="invalid" :aria-describedby="describedBy">
          <option v-for="origin in origins" :key="origin.id" :value="origin.id">
            {{ origin.name }} ({{ formatQuantity(origin.available) }} disponible)
          </option>
        </BaseSelect>
      </FormField>

      <FormField v-slot="{ describedBy, invalid }" label="Hacia" for="transfer-to" :error="fieldError('to_establishment_id')">
        <BaseSelect id="transfer-to" v-model="toId" :invalid="invalid" :aria-describedby="describedBy">
          <option v-for="destination in destinations" :key="destination.id" :value="destination.id">{{ destination.name }}</option>
        </BaseSelect>
      </FormField>

      <FormField v-slot="{ describedBy, invalid }" label="Cantidad" for="transfer-quantity" :error="fieldError('quantity')">
        <BaseInput
          id="transfer-quantity"
          v-model="quantity"
          :inputmode="allowsDecimals ? 'decimal' : 'numeric'"
          data-autofocus
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <FormField v-slot="{ describedBy, invalid }" label="Nota (opcional)" for="transfer-note" :error="fieldError('note')">
        <BaseInput id="transfer-note" v-model="note" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
    </form>

    <template #actions>
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton v-if="origins.length > 0" type="submit" form="transfer-form" :loading="submitting" :disabled="!toId" data-test="confirm-transfer">
        Trasladar
      </BaseButton>
    </template>
  </BaseDialog>
</template>
