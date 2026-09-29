<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatQuantity, today } from '@/shared/utils/format'
import { inventoryApi } from '../api'
import { useInventoryCatalogs } from '../composables/useInventoryCatalogs'
import type { Product, StockEntryPayload } from '../types'

/**
 * Entrada rápida (CE-003, < 30 s desde el celular): solo la cantidad es
 * obligatoria, más el vencimiento si el producto lo controla. El resto va
 * plegado con valores por defecto.
 */
const route = useRoute()
const router = useRouter()
const { load: loadCatalogs, unitLabel, allowsDecimals } = useInventoryCatalogs()
const { submitting, generalError, fieldError, submit } = useApiForm()

const productId = Number(route.params.id)
const product = ref<Product | null>(null)
const loadError = ref<string | null>(null)
const showMore = ref(false)
const form = ref({ quantity: '', expires_at: '', received_at: today(), lot_number: '', unit_cost: '', reference: '' })

const decimals = computed(() => (product.value ? allowsDecimals(product.value.unit) : false))

onMounted(async () => {
  loadCatalogs()
  try {
    product.value = await inventoryApi.getProduct(productId)
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar el producto.'
  }
})

async function onSubmit() {
  const payload: StockEntryPayload = { quantity: form.value.quantity }
  if (product.value?.tracks_expiry) payload.expires_at = form.value.expires_at
  if (form.value.received_at && form.value.received_at !== today()) payload.received_at = form.value.received_at
  if (form.value.lot_number) payload.lot_number = form.value.lot_number
  if (form.value.unit_cost) payload.unit_cost = form.value.unit_cost
  if (form.value.reference) payload.reference = form.value.reference

  const ok = await submit(() => inventoryApi.registerEntry(productId, payload))

  // Si el error está en un campo plegado, se despliega para que se vea.
  if (!ok && ['received_at', 'lot_number', 'unit_cost', 'reference'].some((f) => fieldError(f))) showMore.value = true
  if (ok) await router.push({ name: 'product-detail', params: { id: productId }, query: { entrada: '1' } })
}
</script>

<template>
  <BaseAlert v-if="loadError" variant="error">{{ loadError }}</BaseAlert>

  <template v-else-if="product">
    <h1 class="text-xl font-semibold">Registrar entrada</h1>
    <p class="text-sm text-ink-muted">
      {{ product.name }} · Stock actual {{ formatQuantity(product.stock) }} {{ unitLabel(product.unit).toLowerCase() }}
    </p>

    <form class="mt-4 max-w-md space-y-4 rounded-xl border border-line bg-surface p-5" novalidate @submit.prevent="onSubmit">
      <BaseAlert v-if="generalError || fieldError('product')" variant="error">{{ fieldError('product') ?? generalError }}</BaseAlert>

      <FormField v-slot="{ describedBy, invalid }" label="Cantidad recibida" for="quantity" :error="fieldError('quantity')">
        <BaseInput
          id="quantity"
          v-model="form.quantity"
          :inputmode="decimals ? 'decimal' : 'numeric'"
          autofocus
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <FormField
        v-if="product.tracks_expiry"
        v-slot="{ describedBy, invalid }"
        label="Fecha de vencimiento"
        for="expires_at"
        :error="fieldError('expires_at')"
      >
        <BaseInput id="expires_at" v-model="form.expires_at" type="date" :min="today()" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>

      <button
        type="button"
        class="min-h-11 text-sm font-medium text-brand-700"
        :aria-expanded="showMore"
        aria-controls="entry-more"
        @click="showMore = !showMore"
      >
        {{ showMore ? 'Ocultar datos opcionales' : 'Más datos (lote, costo, fecha, referencia)' }}
      </button>

      <div v-show="showMore" id="entry-more" class="space-y-4">
        <FormField v-slot="{ describedBy, invalid }" label="Fecha de ingreso" for="received_at" :error="fieldError('received_at')">
          <BaseInput id="received_at" v-model="form.received_at" type="date" :max="today()" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField
          v-slot="{ describedBy, invalid }"
          label="Número de lote"
          for="lot_number"
          hint="Si lo dejas vacío, se genera uno automáticamente."
          :error="fieldError('lot_number')"
        >
          <BaseInput id="lot_number" v-model="form.lot_number" autocomplete="off" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ describedBy, invalid }" label="Costo unitario" for="unit_cost" :error="fieldError('unit_cost')">
          <BaseInput id="unit_cost" v-model="form.unit_cost" inputmode="decimal" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ describedBy, invalid }" label="Referencia (factura, proveedor…)" for="reference" :error="fieldError('reference')">
          <BaseInput id="reference" v-model="form.reference" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
      </div>

      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <BaseButton variant="secondary" @click="router.back()">Cancelar</BaseButton>
        <BaseButton type="submit" :loading="submitting">Registrar entrada</BaseButton>
      </div>
    </form>
  </template>
</template>
