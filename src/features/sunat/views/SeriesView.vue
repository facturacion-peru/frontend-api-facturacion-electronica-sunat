<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { ApiError } from '@/core/api/errors'
import { useApiForm } from '@/shared/composables/useApiForm'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import FormField from '@/shared/ui/FormField.vue'
import { seriesApi } from '../api'
import SeriesList from '../components/SeriesList.vue'
import { documentTypePrefix, suggestedSeries, type DocumentType, type Series, type SeriesForm } from '../types'

/**
 * Series de facturas y boletas (HU-3). El correlativo no se edita: solo se
 * indica el último número usado al crear la serie, si ya se emitía antes.
 * Con varios locales, cada serie es de un local y se agrupan por local
 * (spec 017, HU-1 esc. 5); con uno solo, todo se ve como antes (RF-010).
 */
const establishments = useEstablishmentStore()
const series = ref<Series[]>([])
const loadError = ref<string | null>(null)
const notice = ref<string | null>(null)
const busyId = ref<number | null>(null)

const form = ref<SeriesForm>({ document_type: '03', code: 'B001', last_number: 0 })
const { submitting, generalError, fieldError, submit } = useApiForm()
/** Local de la serie nueva: por defecto, el principal. */
const establishmentId = ref<number | null>(null)

const titles: Record<DocumentType, string> = { '01': 'Facturas', '03': 'Boletas', '07': 'Notas de crédito' }

function groupsOf(items: Series[]) {
  return (['01', '03', '07'] as DocumentType[]).map((type) => ({
    type,
    title: titles[type],
    items: items.filter((s) => s.document_type === type),
  }))
}

const groups = computed(() => groupsOf(series.value))

/** Con varios locales: los activos y los inactivos que tienen series. */
const byEstablishment = computed(() =>
  establishments.filterOptions
    .filter((e) => e.active || series.value.some((s) => s.establishment_id === e.id))
    .map((establishment) => ({ establishment, groups: groupsOf(series.value.filter((s) => s.establishment_id === establishment.id)) })),
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

onMounted(async () => {
  load()
  await establishments.loadReadable()
  establishmentId.value = establishments.allowed.find((e) => e.is_main)?.id ?? establishments.allowed[0]?.id ?? null
})

async function onSubmit() {
  notice.value = null
  const code = form.value.code.toUpperCase()
  const body: SeriesForm = { ...form.value, code, ...(establishments.multi && establishmentId.value && { establishment_id: establishmentId.value }) }
  const ok = await submit(() => seriesApi.create(body))
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
    <div v-if="establishments.multi" class="space-y-8">
      <section
        v-for="{ establishment, groups: localGroups } in byEstablishment"
        :key="establishment.id"
        :aria-labelledby="`establishment-${establishment.id}`"
        :data-test="`establishment-series-${establishment.id}`"
        class="space-y-4"
      >
        <h2 :id="`establishment-${establishment.id}`" class="flex flex-wrap items-center gap-2 text-lg font-semibold">
          {{ establishment.name }}
          <span class="font-mono text-sm font-normal text-ink-muted">{{ establishment.code }}</span>
          <BaseBadge v-if="!establishment.active">Inactivo</BaseBadge>
        </h2>
        <div v-for="group in localGroups" :key="group.type">
          <h3 class="text-sm font-medium text-ink-muted">{{ group.title }}</h3>
          <p v-if="group.items.length === 0" class="mt-1 text-sm text-ink-muted">Sin series.</p>
          <SeriesList v-else class="mt-2" :items="group.items" :busy-id="busyId" @toggle="toggle" />
        </div>
      </section>
    </div>

    <div v-else class="space-y-6">
      <section v-for="group in groups" :key="group.type" :aria-labelledby="`group-${group.type}`" :data-test="`group-${group.type}`">
        <h2 :id="`group-${group.type}`" class="font-semibold">{{ group.title }}</h2>
        <EmptyState v-if="group.items.length === 0" class="mt-2" :title="`Sin series de ${group.title.toLowerCase()}`" />
        <SeriesList v-else class="mt-2" :items="group.items" :busy-id="busyId" @toggle="toggle" />
      </section>
    </div>

    <section class="h-fit rounded-xl border border-line bg-surface p-5" aria-labelledby="new-series-title">
      <h2 id="new-series-title" class="font-semibold">Nueva serie</h2>
      <form class="mt-4 space-y-4" novalidate @submit.prevent="onSubmit">
        <BaseAlert v-if="generalError" variant="error">{{ generalError }}</BaseAlert>
        <FormField v-if="establishments.multi" label="Local" for="series-establishment" :error="fieldError('establishment_id')">
          <BaseSelect id="series-establishment" v-model="establishmentId">
            <option v-for="establishment in establishments.allowed" :key="establishment.id" :value="establishment.id">{{ establishment.name }}</option>
          </BaseSelect>
        </FormField>
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
