<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { formatQuantity } from '@/shared/utils/format'
import { dataTransferApi } from '../api'
import type { ImportKind, ImportMode, ImportPreview, ImportResult, ImportValue } from '../types'

/**
 * Importar productos o clientes (spec 014, HU-4 y HU-5) en pasos:
 * 1. tipo, plantilla, archivo y modo («Solo crear» por defecto, A-70);
 * 2. vista previa: nada se guarda hasta confirmar, y con un error no se
 *    importa ninguna fila (A-71);
 * 3. resultado.
 * Un 409 o 410 al confirmar vuelve al paso 1: hay que revisar de nuevo.
 */
const PAGE = 50

/** Extensiones y tipos MIME: el selector de Android filtra por MIME (T003). */
const ACCEPT = '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'

/** Nombres legibles de las columnas de la plantilla. */
const COLUMN_LABELS: Record<string, string> = {
  codigo: 'Código', nombre: 'Nombre', tipo: 'Tipo', unidad: 'Unidad', precio_venta: 'Precio de venta',
  afectacion_igv: 'Afectación IGV', stock_minimo: 'Stock mínimo', controla_vencimiento: 'Controla vencimiento',
  activo: 'Activo', tipo_documento: 'Tipo de documento', numero_documento: 'Número de documento', direccion: 'Dirección',
}

const kind = ref<ImportKind>('products')
const mode = ref<ImportMode>('create')
const file = ref<File | null>(null)
const preview = ref<ImportPreview | null>(null)
const result = ref<ImportResult | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const confirmOpen = ref(false)
const shown = ref(PAGE)
const now = ref(Date.now())

useIntervalFn(() => (now.value = Date.now()), 15_000)

const nouns = computed(() => (kind.value === 'products' ? ['producto', 'productos'] : ['cliente', 'clientes']))
const expired = computed(() => preview.value !== null && new Date(preview.value.expires_at).getTime() <= now.value)
const canConfirm = computed(() => preview.value?.can_confirm === true && !expired.value)
const visibleChanges = computed(() => preview.value?.changes.slice(0, shown.value) ?? [])

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** «Se creará 1 producto y se actualizará 1.» */
const confirmText = computed(() => {
  if (!preview.value) return ''
  const { create, update } = preview.value.summary
  const parts = []
  if (create > 0) parts.push(`${create === 1 ? 'Se creará' : 'Se crearán'} ${plural(create, nouns.value[0]!, nouns.value[1]!)}`)
  if (update > 0) parts.push(`${parts.length ? 'se' : 'Se'} ${update === 1 ? 'actualizará' : 'actualizarán'} ${update}`)

  return `${parts.join(' y ')}. ¿Continuar?`
})

function label(column: string): string {
  return COLUMN_LABELS[column] ?? column
}

function show(value: ImportValue): string {
  if (value === null || value === '') return '(vacío)'
  if (typeof value === 'boolean') return value ? 'sí' : 'no'

  return value
}

function onFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function downloadTemplate() {
  error.value = null
  try {
    await dataTransferApi.template(kind.value)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo descargar la plantilla.'
  }
}

async function review() {
  if (!file.value) return
  busy.value = true
  error.value = null
  try {
    preview.value = await dataTransferApi.preview(kind.value, file.value, mode.value)
    shown.value = PAGE
    now.value = Date.now()
  } catch (e) {
    error.value = e instanceof ApiError ? (e.field('file') ?? e.field('mode') ?? e.message) : 'No se pudo revisar el archivo.'
  } finally {
    busy.value = false
  }
}

async function confirm() {
  if (!preview.value) return
  confirmOpen.value = false
  busy.value = true
  error.value = null
  try {
    result.value = await dataTransferApi.confirm(preview.value.id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo importar.'
    if (e instanceof ApiError && (e.status === 409 || e.status === 410)) restart(false)
  } finally {
    busy.value = false
  }
}

/** Vuelve al paso 1 (conserva el tipo y el modo). */
function restart(clearError = true) {
  preview.value = null
  result.value = null
  file.value = null
  if (clearError) error.value = null
}
</script>

<template>
  <div>
    <!-- Paso 3: resultado -->
    <div v-if="result" data-test="import-done" class="space-y-4">
      <BaseAlert variant="success" title="Importación completada">
        {{ plural(result.created, 'creado', 'creados') }}, {{ plural(result.updated, 'actualizado', 'actualizados') }}<template v-if="kind === 'products'"> y {{ result.entries }} con stock inicial</template>.
        Todo quedó en la auditoría.
      </BaseAlert>
      <div class="flex flex-wrap gap-2">
        <RouterLink :to="{ name: kind === 'products' ? 'products' : 'customers' }">
          <BaseButton tabindex="-1">Ver {{ nouns[1] }}</BaseButton>
        </RouterLink>
        <BaseButton variant="secondary" @click="restart()">Importar otro archivo</BaseButton>
      </div>
    </div>

    <!-- Paso 2: vista previa -->
    <div v-else-if="preview" class="space-y-4">
      <div data-test="import-summary" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <p class="rounded-lg bg-subtle p-3 text-sm"><span class="block text-lg font-semibold">{{ preview.summary.create }}</span> {{ preview.summary.create === 1 ? 'nuevo' : 'nuevos' }}</p>
        <p class="rounded-lg bg-subtle p-3 text-sm"><span class="block text-lg font-semibold">{{ preview.summary.update }}</span> con cambios</p>
        <p class="rounded-lg bg-subtle p-3 text-sm"><span class="block text-lg font-semibold">{{ preview.summary.unchanged }}</span> sin cambios</p>
        <p class="rounded-lg p-3 text-sm" :class="preview.summary.errors ? 'bg-danger-50 text-danger-700' : 'bg-subtle'">
          <span class="block text-lg font-semibold">{{ preview.summary.errors }}</span> con errores
        </p>
      </div>

      <BaseAlert v-if="error" variant="error">{{ error }}</BaseAlert>
      <BaseAlert v-if="expired" variant="warning">La vista previa caducó. Vuelve a subir el archivo para revisarlo de nuevo.</BaseAlert>

      <div v-if="preview.errors.length" data-test="import-errors">
        <BaseAlert variant="error" title="Corrige el archivo y vuelve a subirlo">
          Con un solo error no se importa ninguna fila, para que no quede nada a medias.
        </BaseAlert>
        <ul class="mt-2 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
          <li v-for="(issue, index) in preview.errors" :key="index" class="p-3">
            <span class="font-medium">Fila {{ issue.row }} · {{ issue.column }}</span>
            <span class="block text-ink-muted">{{ issue.message }}</span>
          </li>
        </ul>
      </div>

      <ul v-if="preview.warnings.length" class="space-y-1 text-sm text-warning-700">
        <li v-for="(issue, index) in preview.warnings" :key="index">
          <template v-if="issue.row">Fila {{ issue.row }} · </template>{{ issue.column }}: {{ issue.message }}
        </li>
      </ul>

      <ul v-if="visibleChanges.length" class="divide-y divide-line rounded-xl border border-line bg-surface">
        <li v-for="change in visibleChanges" :key="change.row" :data-test="`import-change-${change.row}`" class="p-3 text-sm">
          <p class="flex flex-wrap items-center gap-2">
            <span class="rounded bg-subtle px-1.5 text-xs font-medium">{{ change.action === 'create' ? 'Nuevo' : 'Cambia' }}</span>
            <span class="font-medium">{{ change.key }}</span>
            <span class="min-w-0 truncate text-ink-muted">{{ change.name }}</span>
            <span class="ml-auto text-xs text-ink-muted">Fila {{ change.row }}</span>
          </p>
          <p v-if="change.action === 'create' && change.stock" class="mt-1 text-ink-muted">Stock inicial: {{ formatQuantity(change.stock) }}</p>
          <dl v-if="change.action === 'update'" class="mt-1 grid grid-cols-1 gap-1">
            <div v-for="(diff, column) in change.fields" :key="column" class="text-ink-muted">
              <dt class="inline">{{ label(String(column)) }}:</dt>
              <dd class="inline"> {{ show(diff.from) }} → <span class="font-medium text-ink">{{ show(diff.to) }}</span></dd>
            </div>
          </dl>
        </li>
      </ul>
      <BaseButton v-if="preview.changes.length > shown" variant="secondary" @click="shown += PAGE">
        Mostrar más ({{ preview.changes.length - shown }} restantes)
      </BaseButton>

      <div class="flex flex-wrap gap-2">
        <BaseButton :disabled="!canConfirm" :loading="busy" @click="confirmOpen = true">Confirmar importación</BaseButton>
        <BaseButton variant="secondary" @click="restart()">Elegir otro archivo</BaseButton>
      </div>

      <BaseDialog v-model:open="confirmOpen" title="Confirmar importación">
        <p class="text-sm">{{ confirmText }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <BaseButton variant="secondary" @click="confirmOpen = false">Cancelar</BaseButton>
          <BaseButton data-autofocus @click="confirm">Sí, importar</BaseButton>
        </div>
      </BaseDialog>
    </div>

    <!-- Paso 1: tipo, plantilla, archivo y modo -->
    <form v-else class="space-y-5" novalidate @submit.prevent="review">
      <fieldset>
        <legend class="text-sm font-medium text-ink">¿Qué vas a importar?</legend>
        <div class="mt-2 flex flex-wrap gap-4">
          <label class="flex min-h-11 items-center gap-2 text-sm"><input v-model="kind" type="radio" name="import-kind" value="products" class="size-4" /> Productos</label>
          <label class="flex min-h-11 items-center gap-2 text-sm"><input v-model="kind" type="radio" name="import-kind" value="customers" class="size-4" /> Clientes</label>
        </div>
      </fieldset>

      <div class="rounded-lg bg-subtle p-3 text-sm">
        <p>Usa la plantilla: trae las columnas, un ejemplo de cada una y los valores admitidos. Se importan hasta 2 000 filas.</p>
        <BaseButton variant="secondary" class="mt-2" @click="downloadTemplate">Descargar plantilla</BaseButton>
      </div>

      <div class="space-y-1.5">
        <label for="import-file" class="block text-sm font-medium text-ink">Archivo (XLSX o CSV)</label>
        <input id="import-file" type="file" :accept="ACCEPT" class="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-surface file:px-4 file:text-ink" @change="onFile" />
      </div>

      <fieldset>
        <legend class="text-sm font-medium text-ink">Si ya existe</legend>
        <div class="mt-2 space-y-2">
          <label class="flex items-start gap-2 text-sm">
            <input v-model="mode" type="radio" name="import-mode" value="create" class="mt-0.5 size-4" />
            <span><span class="font-medium">Solo crear.</span> Los que ya existen se marcan como error y no se tocan.</span>
          </label>
          <label class="flex items-start gap-2 text-sm">
            <input v-model="mode" type="radio" name="import-mode" value="upsert" class="mt-0.5 size-4" />
            <span><span class="font-medium">Crear y actualizar.</span> Los que ya existen se actualizan con los datos del archivo; antes verás cada cambio. El stock nunca se cambia.</span>
          </label>
        </div>
      </fieldset>

      <BaseAlert v-if="error" variant="error">{{ error }}</BaseAlert>

      <BaseButton type="submit" :disabled="!file" :loading="busy">Revisar archivo</BaseButton>
    </form>
  </div>
</template>
