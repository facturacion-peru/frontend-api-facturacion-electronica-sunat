<script setup lang="ts">
/**
 * Botón «Exportar» de una lista (spec 014): elige el formato (y lo que el
 * slot agregue, p. ej. «con lotes») y descarga respetando los filtros de la
 * pantalla. En Android, la descarga abre «Compartir».
 */
import { ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import BaseAlert from './BaseAlert.vue'
import BaseButton from './BaseButton.vue'
import BaseDialog from './BaseDialog.vue'
import BaseSelect from './BaseSelect.vue'

const props = defineProps<{
  title: string
  /** Pide la descarga en el formato elegido. */
  download: (format: 'xlsx' | 'csv') => Promise<unknown>
}>()

const open = ref(false)
const format = ref<'xlsx' | 'csv'>('xlsx')
const downloading = ref(false)
const error = ref<string | null>(null)
const formatId = `export-format-${Math.random().toString(36).slice(2, 8)}`

async function run() {
  downloading.value = true
  error.value = null
  try {
    await props.download(format.value)
    open.value = false
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo descargar el archivo.'
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <BaseButton variant="secondary" @click="open = true">Exportar</BaseButton>

  <BaseDialog v-model:open="open" :title="title">
    <p class="text-sm text-ink-muted">Se exporta lo que muestra la lista con los filtros actuales.</p>
    <div class="mt-4 space-y-4">
      <div class="space-y-1.5">
        <label :for="formatId" class="block text-sm font-medium text-ink">Formato</label>
        <BaseSelect :id="formatId" v-model="format" data-test="export-format">
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV</option>
        </BaseSelect>
      </div>
      <slot />
      <BaseAlert v-if="error" variant="error">{{ error }}</BaseAlert>
    </div>
    <div class="mt-4 flex justify-end gap-2">
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton data-autofocus :loading="downloading" @click="run">Descargar</BaseButton>
    </div>
  </BaseDialog>
</template>
