<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { ApiError } from '@/core/api/errors'
import { useApiForm } from '@/shared/composables/useApiForm'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import FormField from '@/shared/ui/FormField.vue'
import { seriesApi } from '../api'
import { documentTypePrefix, suggestedSeries, type DocumentType, type Series, type SeriesForm } from '../types'

/**
 * Series de facturas y boletas (HU-3). El correlativo no se edita: solo se
 * indica el último número usado al crear la serie, si ya se emitía antes.
 */
const series = ref<Series[]>([])
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)
const busyId = ref<number | null>(null)

const form = ref<SeriesForm>({ document_type: '03', code: 'B001', last_number: 0 })
const { submitting, generalError, fieldError, submit } = useApiForm()


const groups = computed(() =>
  (['01', '03', '07'] as DocumentType[]).map((type) => ({
    type,
    title: { '01': 'Facturas', '03': 'Boletas', '07': 'Notas de crédito' }[type],
    items: series.value.filter((s) => s.document_type === type),
  })),
)

// Al cambiar el tipo se propone su serie (F001, B001; BC01 para notas de boletas).
watch(
  () => form.value.document_type,
  (type) => {
    form.value.code = suggestedSeries[type]
  },
)

async function load() {
  try {
    series.value = await seriesApi.list()
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudieron cargar las series.'
  }
}

onMounted(load)

async function onSubmit() {
  notice.value = null
  const code = form.value.code.toUpperCase()
  const ok = await submit(() => seriesApi.create({ ...form.value, code }))
  if (ok) {
    notice.value = `Serie ${code} creada.`
    form.value = { ...form.value, last_number: 0 }
    await load()
  }
}

async function toggle(item: Series) {
  busyId.value = item.id
  notice.value = null
  loadError.value = null
  try {
    await seriesApi.setActive(item.id, !item.active)
    notice.value = item.active ? `Serie ${item.code} desactivada.` : `Serie ${item.code} activada.`
    await load()
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    loadError.value = e.message
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <h1 class="text-xl font-semibold">Series</h1>
  <p class="mt-1 text-sm text-ink-muted">Cada comprobante lleva una serie y un número correlativo que nunca retrocede.</p>

  <BaseAlert v-if="loadError" variant="error" class="mt-4">{{ loadError }}</BaseAlert>
  <BaseAlert v-if="notice" variant="success" class="mt-4">{{ notice }}</BaseAlert>

  <div class="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]">
    <div class="space-y-6">
      <section v-for="group in groups" :key="group.type" :aria-labelledby="`group-${group.type}`" :data-test="`group-${group.type}`">
        <h2 :id="`group-${group.type}`" class="font-semibold">{{ group.title }}</h2>
        <EmptyState v-if="group.items.length === 0" class="mt-2" :title="`Sin series de ${group.title.toLowerCase()}`" />
        <ul v-else class="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
          <li v-for="item in group.items" :key="item.id" class="flex flex-wrap items-center justify-between gap-3 p-4" :data-test="`series-${item.code}`">
            <div>
              <p class="font-mono font-medium">
                {{ item.code }}
                <BaseBadge v-if="!item.active" class="ml-1 font-sans">Desactivada</BaseBadge>
              </p>
              <p class="text-sm text-ink-muted">
                Último número: {{ item.last_number }} · Siguiente: <span class="font-medium text-ink">{{ item.next_number }}</span>
              </p>
            </div>
            <BaseButton variant="secondary" :loading="busyId === item.id" @click="toggle(item)">
              {{ item.active ? 'Desactivar' : 'Activar' }}
            </BaseButton>
          </li>
        </ul>
      </section>
    </div>

    <section class="h-fit rounded-xl border border-line bg-surface p-5" aria-labelledby="new-series-title">
      <h2 id="new-series-title" class="font-semibold">Nueva serie</h2>
      <form class="mt-4 space-y-4" novalidate @submit.prevent="onSubmit">
        <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>
        <FormField label="Tipo de comprobante" for="document_type" :error="fieldError('document_type')">
          <BaseSelect id="document_type" v-model="form.document_type">
            <option value="03">Boleta</option>
            <option value="01">Factura</option>
            <option value="07">Nota de crédito</option>
          </BaseSelect>
        </FormField>
        <FormField
          v-slot="{ describedBy, invalid }"
          label="Serie"
          for="code"
          :hint="form.document_type === '07' ? '4 caracteres: F para notas de facturas (FC01) o B para notas de boletas (BC01).' : `4 caracteres: ${documentTypePrefix[form.document_type]} y tres letras o números.`"
          :error="fieldError('code')"
        >
          <BaseInput id="code" v-model="form.code" maxlength="4" class="font-mono uppercase" :invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField
          v-slot="{ describedBy, invalid }"
          label="Último número usado"
          for="last_number"
          hint="0 si es una serie nueva. Si ya emitías con ella, el último número emitido."
          :error="fieldError('last_number')"
        >
          <BaseInput
            id="last_number"
            v-model.number="form.last_number"
            type="number"
            min="0"
            inputmode="numeric"
            :invalid="invalid"
            :aria-describedby="describedBy"
          />
        </FormField>
        <BaseButton type="submit" :loading="submitting">Crear serie</BaseButton>
      </form>
    </section>
  </div>
</template>
