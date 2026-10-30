<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import { UploadCancelled } from '@/core/api/upload'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import FormField from '@/shared/ui/FormField.vue'
import ImagePicker from '@/shared/ui/ImagePicker.vue'
import { inventoryApi } from '../api'
import ProductPhotoEditor from '../components/ProductPhotoEditor.vue'
import { useInventoryCatalogs } from '../composables/useInventoryCatalogs'
import type { Product, ProductPayload } from '../types'

const route = useRoute()
const router = useRouter()
const { catalogs, load: loadCatalogs, allowsDecimals } = useInventoryCatalogs()
const { submitting, generalError, fieldError, submit } = useApiForm()

const productId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => productId.value !== null)
const loadError = ref<string | null>(null)
/** Al editar: el producto cargado, para su foto (que se guarda aparte). */
const product = ref<Product | null>(null)
const photoNotice = ref<string | null>(null)
/** Al crear: la foto elegida se sube después de crear el producto (spec 016, HU-1 esc. 7). */
const newPhoto = ref<File | null>(null)
const uploadProgress = ref<number | null>(null)
let uploadController: AbortController | null = null
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
    const loaded = await inventoryApi.getProduct(productId.value!)
    product.value = loaded
    form.value = {
      code: loaded.code,
      name: loaded.name,
      type: loaded.type,
      unit: loaded.unit,
      sale_price: loaded.sale_price,
      igv_affectation: loaded.igv_affectation,
      min_stock: loaded.min_stock,
      tracks_expiry: loaded.tracks_expiry,
      active: loaded.active,
    }
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar el producto.'
  }
})

async function onSubmit() {
  // Con Enter el formulario se envía aunque el botón esté ocupado: mientras se
  // guarda o sube la foto del recién creado, otro envío lo duplicaría.
  if (submitting.value || uploadProgress.value !== null) return

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

  if (!ok) return

  // El producto ya está creado: si la foto falla o se cancela, se avisa en su ficha.
  const photoFailed = newPhoto.value !== null && !(await uploadNewPhoto(id!))
  const query = warning ? { aviso: warning } : { guardado: '1', ...(photoFailed && { foto: 'pendiente' }) }
  await router.push({ name: 'product-detail', params: { id }, query })
}

/** Sube la foto del producto recién creado; false si falló o se canceló. */
async function uploadNewPhoto(id: number): Promise<boolean> {
  uploadController = new AbortController()
  uploadProgress.value = 0

  try {
    await inventoryApi.uploadImage(id, newPhoto.value!, {
      onProgress: (fraction) => (uploadProgress.value = fraction),
      signal: uploadController.signal,
    })
    return true
  } catch (e) {
    if (e instanceof ApiError || e instanceof UploadCancelled) return false
    throw e
  } finally {
    uploadController = null
    uploadProgress.value = null
  }
}

function cancelNewPhoto() {
  uploadController?.abort()
}

function onPhotoUpdated(updated: Product, message: string) {
  product.value = updated
  photoNotice.value = message
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
      <p v-if="fieldError('type')" class="mt-1 text-xs text-danger-700">{{ fieldError('type') }}</p>
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
        <BaseSelect id="unit" v-model="form.unit">
          <option v-for="unit in catalogs?.units ?? []" :key="unit.code" :value="unit.code">{{ unit.label }}</option>
        </BaseSelect>
      </FormField>
    </div>

    <FormField label="Afectación al IGV" for="igv_affectation" :error="fieldError('igv_affectation')">
      <BaseSelect id="igv_affectation" v-model="form.igv_affectation">
        <option v-for="item in catalogs?.igv_affectations ?? []" :key="item.code" :value="item.code">{{ item.label }}</option>
      </BaseSelect>
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
      <p v-if="fieldError('tracks_expiry')" class="text-xs text-danger-700">{{ fieldError('tracks_expiry') }}</p>
    </template>

    <label v-if="isEdit" class="flex min-h-11 items-center gap-2 text-sm">
      <input id="active" v-model="form.active" type="checkbox" />
      Activo (disponible para vender)
    </label>

    <!-- Al editar, la foto se guarda aparte de «Guardar cambios» (spec 016). -->
    <template v-if="isEdit">
      <ProductPhotoEditor v-if="product" :product="product" class="border-t border-line pt-4" @updated="onPhotoUpdated" />
      <p v-if="photoNotice" class="text-xs text-success-700" role="status">{{ photoNotice }}</p>
    </template>
    <section v-else class="border-t border-line pt-4" aria-labelledby="new-photo-title">
      <h2 id="new-photo-title" class="text-sm font-medium">Foto (opcional)</h2>
      <div class="mt-2">
        <ImagePicker v-model="newPhoto" :image="null" :name="form.name || 'Nuevo producto'" :disabled="submitting || uploadProgress !== null" />
      </div>
    </section>

    <div v-if="uploadProgress !== null" class="flex flex-wrap items-center gap-2" data-test="new-photo-progress">
      <div
        class="h-2 w-40 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-label="Subiendo la foto"
        :aria-valuenow="Math.round(uploadProgress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="h-full bg-brand-600 transition-[width]" :style="{ width: `${Math.round(uploadProgress * 100)}%` }" />
      </div>
      <span class="text-xs text-ink-muted">Producto creado. Subiendo la foto… {{ Math.round(uploadProgress * 100) }} %</span>
      <BaseButton variant="ghost" data-test="cancel-new-photo" @click="cancelNewPhoto">Cancelar</BaseButton>
    </div>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <BaseButton variant="secondary" :disabled="uploadProgress !== null" @click="router.back()">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="submitting || uploadProgress !== null">{{ isEdit ? 'Guardar cambios' : 'Crear producto' }}</BaseButton>
    </div>
  </form>
</template>
