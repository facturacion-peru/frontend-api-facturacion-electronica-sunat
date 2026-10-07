<script setup lang="ts">
import { ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import ImportWizard from '../components/ImportWizard.vue'
import SalesExportForm from '../components/SalesExportForm.vue'
import { dataTransferApi } from '../api'
import type { ExportFormat } from '../types'

/**
 * Importar y exportar (spec 014): ventas por rango de fechas, catálogo y
 * clientes completos, e importación de productos y clientes. Cada operación
 * queda en la auditoría.
 */
const format = ref<ExportFormat>('xlsx')
const exporting = ref<'products' | 'customers' | null>(null)
const exportError = ref<string | null>(null)

async function exportAll(what: 'products' | 'customers') {
  exporting.value = what
  exportError.value = null
  try {
    await (what === 'products' ? dataTransferApi.exportProducts(format.value) : dataTransferApi.exportCustomers(format.value))
  } catch (e) {
    exportError.value = e instanceof ApiError ? e.message : 'No se pudo descargar el archivo.'
  } finally {
    exporting.value = null
  }
}
</script>

<template>
  <h1 class="text-xl font-semibold">Importar y exportar</h1>
  <p class="mt-1 text-sm text-ink-muted">Saca tus datos a Excel o carga tu catálogo y tus clientes desde otro sistema. Todo queda en la auditoría.</p>

  <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <section aria-labelledby="export-sales-title" class="rounded-xl border border-line bg-surface p-4">
      <h2 id="export-sales-title" class="font-semibold">Exportar ventas</h2>
      <p class="mt-1 mb-4 text-sm text-ink-muted">Tickets, boletas, facturas y notas de crédito de hasta 12 meses.</p>
      <SalesExportForm />
    </section>

    <section aria-labelledby="export-all-title" class="rounded-xl border border-line bg-surface p-4">
      <h2 id="export-all-title" class="font-semibold">Exportar catálogo y clientes</h2>
      <p class="mt-1 text-sm text-ink-muted">Completos. Para exportar solo una parte, usa el botón «Exportar» de cada lista con sus filtros.</p>
      <div class="mt-4 space-y-4">
        <div class="space-y-1.5">
          <label for="export-all-format" class="block text-sm font-medium text-ink">Formato</label>
          <BaseSelect id="export-all-format" v-model="format">
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV</option>
          </BaseSelect>
        </div>
        <div class="flex flex-wrap gap-2">
          <BaseButton variant="secondary" :loading="exporting === 'products'" @click="exportAll('products')">Productos y stock</BaseButton>
          <BaseButton variant="secondary" :loading="exporting === 'customers'" @click="exportAll('customers')">Clientes</BaseButton>
        </div>
        <BaseAlert v-if="exportError" variant="error">{{ exportError }}</BaseAlert>
      </div>
    </section>

    <section aria-labelledby="import-title" class="rounded-xl border border-line bg-surface p-4 lg:col-span-2">
      <h2 id="import-title" class="font-semibold">Importar productos o clientes</h2>
      <p class="mt-1 mb-4 text-sm text-ink-muted">Primero revisas qué cambiará; nada se guarda hasta que confirmes.</p>
      <ImportWizard />
    </section>
  </div>
</template>
