<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { inventoryApi } from '../api'
import { useInventoryCatalogs } from '../composables/useInventoryCatalogs'
import type { ProductPayload } from '../types'

const route = useRoute()
const router = useRouter()
const { catalogs, load: loadCatalogs, allowsDecimals } = useInventoryCatalogs()
const { submitting, generalError, fieldError, submit } = useApiForm()

const productId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => productId.value !== null)
const loadError = ref<string | null>(null)
const form = ref<ProductPayload>({
  code: '',
  name: '',
  type: 'good',
  unit: 'NIU',
  sale_price: '',
  igv_affectation: '10',
  min_stock: null,
  tracks_expiry: false,
  active: true,
})

const isGood = computed(() => form.value.type === 'good')
const selectClass = 'block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm'

// Un servicio no tiene stock: sin mínimo ni vencimiento, y unidad «servicio» por defecto.
watch(
  () => form.value.type,
  (type, previous) => {
    if (type === 'service' && previous === 'good') {
      form.value.min_stock = null
      form.value.tracks_expiry = false
      if (form.value.unit === 'NIU') form.value.unit = 'ZZ'
    }
  },
)

onMounted(async () => {
  await loadCatalogs()
  if (!isEdit.value) return

  try {
    const product = await inventoryApi.getProduct(productId.value!)
    form.value = {
      code: product.code,
      name: product.name,
      type: product.type,
      unit: product.unit,
      sale_price: product.sale_price,
      igv_affectation: product.igv_affectation,
      min_stock: product.min_stock,
      tracks_expiry: product.tracks_expiry,
      active: product.active,
    }
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar el producto.'
  }
})

async function onSubmit() {
  const payload: ProductPayload = { ...form.value, min_stock: form.value.min_stock || null }
  let warning: string | null = null
  let id = productId.value

  const ok = await submit(async () => {
    if (isEdit.value) {
      warning = (await inventoryApi.updateProduct(id!, payload)).warning
    } else {
      // El alta siempre crea el producto activo: no se envía `active`.
      const create = { ...payload }
      delete create.active
      id = (await inventoryApi.createProduct(create)).id
    }
  })

  if (ok) {
    await router.push({ name: 'product-detail', params: { id }, query: warning ? { aviso: warning } : { guardado: '1' } })
  }
}
</script>

<template>
  <h1 class="text-xl font-semibold">{{ isEdit ? 'Editar producto' : 'Nuevo producto' }}</h1>

  <BaseAlert v-if="loadError" variant="error" class="mt-4">{{ loadError }}</BaseAlert>

  <form v-else class="mt-4 max-w-xl space-y-4 rounded-xl border border-line bg-surface p-5" novalidate @submit.prevent="onSubmit">
    <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>

    <fieldset>
      <legend class="text-sm font-medium">Tipo</legend>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label
          v-for="option in [{ value: 'good', label: 'Bien (con stock)' }, { value: 'service', label: 'Servicio' }]"
          :key="option.value"
          class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"
        >
          <input v-model="form.type" type="radio" name="product-type" :value="option.value" />
          {{ option.label }}
        </label>
      </div>
      <p v-if="fieldError('type')" class="mt-1 text-xs text-red-600">{{ fieldError('type') }}</p>
    </fieldset>

    <div class="grid gap-4 sm:grid-cols-[10rem_1fr]">
      <FormField v-slot="{ describedBy, invalid }" label="Código" for="code" :error="fieldError('code')">
        <BaseInput id="code" v-model="form.code" autocomplete="off" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <FormField v-slot="{ describedBy, invalid }" label="Nombre" for="name" :error="fieldError('name')">
        <BaseInput id="name" v-model="form.name" autocomplete="off" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <FormField v-slot="{ describedBy, invalid }" label="Precio de venta (con IGV)" for="sale_price" :error="fieldError('sale_price')">
        <BaseInput
          id="sale_price"
          v-model="form.sale_price"
          inputmode="decimal"
          placeholder="0.00"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <FormField label="Unidad de medida" for="unit" :error="fieldError('unit')">
        <select id="unit" v-model="form.unit" :class="selectClass">
          <option v-for="unit in catalogs?.units ?? []" :key="unit.code" :value="unit.code">{{ unit.label }}</option>
        </select>
      </FormField>
    </div>

    <FormField label="Afectación al IGV" for="igv_affectation" :error="fieldError('igv_affectation')">
      <select id="igv_affectation" v-model="form.igv_affectation" :class="selectClass">
        <option v-for="item in catalogs?.igv_affectations ?? []" :key="item.code" :value="item.code">{{ item.label }}</option>
      </select>
    </FormField>

    <template v-if="isGood">
      <FormField
        v-slot="{ describedBy, invalid }"
        label="Stock mínimo (opcional)"
        for="min_stock"
        hint="Te avisaremos cuando el disponible llegue a este número."
        :error="fieldError('min_stock')"
      >
        <BaseInput
          id="min_stock"
          v-model="form.min_stock"
          :inputmode="allowsDecimals(form.unit) ? 'decimal' : 'numeric'"
          :invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <label class="flex min-h-11 items-center gap-2 text-sm">
        <input id="tracks_expiry" v-model="form.tracks_expiry" type="checkbox" />
        Controla fecha de vencimiento
      </label>
      <p v-if="fieldError('tracks_expiry')" class="text-xs text-red-600">{{ fieldError('tracks_expiry') }}</p>
    </template>

    <label v-if="isEdit" class="flex min-h-11 items-center gap-2 text-sm">
      <input id="active" v-model="form.active" type="checkbox" />
      Activo (disponible para vender)
    </label>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <BaseButton variant="secondary" @click="router.back()">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="submitting">{{ isEdit ? 'Guardar cambios' : 'Crear producto' }}</BaseButton>
    </div>
  </form>
</template>
