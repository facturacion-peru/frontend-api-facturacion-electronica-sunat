<script setup lang="ts">
import { reactive, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import FormField from '@/shared/ui/FormField.vue'
import { todayInLima } from '@/shared/utils/format'
import { dataTransferApi } from '../api'
import type { ExportFormat, SaleKind } from '../types'

/**
 * Exportar ventas (spec 014, HU-3): rango de fechas de Lima de hasta 12
 * meses (A-73), por tipo y estado. El archivo trae una hoja por documento y
 * otra por línea; las notas de crédito, en negativo (A-74).
 */
const kinds: { value: SaleKind; label: string }[] = [
  { value: 'ticket', label: 'Tickets' },
  { value: 'receipt', label: 'Boletas' },
  { value: 'invoice', label: 'Facturas' },
  { value: 'credit_note', label: 'Notas de crédito' },
]

/** Estados de la API agrupados como los entiende el usuario (A-54). */
const statusGroups = {
  all: [],
  counted: ['issued', 'pending', 'sent', 'accepted', 'observed'],
  excluded: ['voided', 'rejected', 'discarded'],
} as const

const today = todayInLima()
const form = reactive({
  from: `${today.slice(0, 8)}01`,
  to: today,
  types: kinds.map((k) => k.value),
  status: 'all' as keyof typeof statusGroups,
  format: 'xlsx' as ExportFormat,
})
const downloading = ref(false)
const error = ref<string | null>(null)
const done = ref(false)

/** Misma regla que la API: hasta 12 meses (la fecha final, antes del mismo día del año siguiente). */
function rangeError(): string | null {
  if (!form.from || !form.to) return 'Indica las dos fechas.'
  if (form.to < form.from) return 'La fecha final no puede ser anterior a la inicial.'
  const oneYearLater = `${Number(form.from.slice(0, 4)) + 1}${form.from.slice(4)}`
  if (form.to >= oneYearLater) return 'El rango no puede superar los 12 meses.'
  if (form.types.length === 0) return 'Elige al menos un tipo de documento.'

  return null
}

async function download() {
  done.value = false
  error.value = rangeError()
  if (error.value) return

  downloading.value = true
  try {
    await dataTransferApi.exportSales({
      from: form.from,
      to: form.to,
      types: kinds.map((k) => k.value).filter((k) => form.types.includes(k)),
      statuses: [...statusGroups[form.status]],
      format: form.format,
    })
    done.value = true
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.fieldErrors)[0]?.[0] ?? e.message) : 'No se pudo descargar el archivo.'
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="download">
    <div class="grid grid-cols-2 gap-3">
      <FormField label="Desde" for="sales-export-from"><BaseInput id="sales-export-from" v-model="form.from" type="date" :max="today" /></FormField>
      <FormField label="Hasta" for="sales-export-to"><BaseInput id="sales-export-to" v-model="form.to" type="date" :max="today" /></FormField>
    </div>

    <fieldset>
      <legend class="text-sm font-medium text-ink">Documentos</legend>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label v-for="kind in kinds" :key="kind.value" class="flex min-h-11 items-center gap-2 text-sm">
          <input v-model="form.types" type="checkbox" :value="kind.value" class="size-4" />
          {{ kind.label }}
        </label>
      </div>
    </fieldset>

    <div class="grid gap-3 sm:grid-cols-2">
      <FormField label="Estados" for="sales-export-status">
        <BaseSelect id="sales-export-status" v-model="form.status">
          <option value="all">Todos</option>
          <option value="counted">Solo los que suman como venta</option>
          <option value="excluded">Solo anulados, rechazados y descartados</option>
        </BaseSelect>
      </FormField>
      <FormField label="Formato" for="sales-export-format">
        <BaseSelect id="sales-export-format" v-model="form.format">
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV (.zip con dos archivos)</option>
        </BaseSelect>
      </FormField>
    </div>

    <BaseAlert v-if="error" variant="error">{{ error }}</BaseAlert>
    <BaseAlert v-else-if="done" variant="success">Descarga lista. La hoja «documentos» trae una fila por venta y «lineas», una por producto vendido.</BaseAlert>

    <BaseButton type="submit" :loading="downloading">Descargar ventas</BaseButton>
  </form>
</template>
