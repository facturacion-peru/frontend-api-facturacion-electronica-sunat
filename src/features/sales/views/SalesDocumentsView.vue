<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import EnvironmentBadge from '@/shared/ui/EnvironmentBadge.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatDateTime, formatMoney } from '@/shared/utils/format'
import { salesDocumentsApi } from '../api'
import SalesTabs from '../components/SalesTabs.vue'
import { correctionVariant, documentStatusVariant, type SalesDocument, type SalesDocumentFilters, type SalesDocumentStatus } from '../types'

/** Comprobantes de la empresa, todos visibles para todos (A-32, HU-6). */
const filters = reactive<SalesDocumentFilters>({ from: '', to: '', document_type: '', status: '', customer: '', page: 1 })
const documents = ref<SalesDocument[]>([])
const meta = ref<PaginationMeta | null>(null)
const counts = ref({ pending: 0, rejected: 0 })
const loading = ref(false)
const error = ref<string | null>(null)
const selectClass = 'block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm'

async function load() {
  loading.value = true
  error.value = null
  try {
    const page = await salesDocumentsApi.list(filters)
    documents.value = page.data
    meta.value = page.meta
    counts.value = page.counts
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.fieldErrors)[0]?.[0] ?? e.message) : 'No se pudieron cargar los comprobantes.'
  } finally {
    loading.value = false
  }
}

function apply() {
  filters.page = 1
  load()
}

function only(status: SalesDocumentStatus) {
  filters.status = status
  apply()
}

function goTo(page: number) {
  filters.page = page
  load()
}

onMounted(load)
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">Ventas</h1>
      <EnvironmentBadge />
    </div>
    <RouterLink :to="{ name: 'new-sale' }"><BaseButton tabindex="-1">Nueva venta</BaseButton></RouterLink>
  </div>
  <SalesTabs />

  <BaseAlert v-if="counts.pending || counts.rejected" variant="warning" class="mt-4" data-test="attention">
    <span v-if="counts.pending">{{ counts.pending }} pendiente{{ counts.pending === 1 ? '' : 's' }} de envío. </span>
    <span v-if="counts.rejected">{{ counts.rejected }} rechazado{{ counts.rejected === 1 ? '' : 's' }} por SUNAT. </span>
    <span class="mt-2 flex flex-wrap gap-2">
      <BaseButton v-if="counts.pending" variant="secondary" @click="only('pending')">Ver pendientes</BaseButton>
      <BaseButton v-if="counts.rejected" variant="secondary" @click="only('rejected')">Ver rechazados</BaseButton>
    </span>
  </BaseAlert>

  <form class="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 lg:grid-cols-6" @submit.prevent="apply">
    <FormField label="Desde" for="docs-from"><BaseInput id="docs-from" v-model="filters.from" type="date" /></FormField>
    <FormField label="Hasta" for="docs-to"><BaseInput id="docs-to" v-model="filters.to" type="date" /></FormField>
    <FormField label="Tipo" for="docs-type">
      <select id="docs-type" v-model="filters.document_type" :class="selectClass">
        <option value="">Todos</option>
        <option value="03">Boletas</option>
        <option value="01">Facturas</option>
        <option value="07">Notas de crédito</option>
      </select>
    </FormField>
    <FormField label="Estado" for="docs-status">
      <select id="docs-status" v-model="filters.status" :class="selectClass">
        <option value="">Todos</option>
        <option value="pending">Pendientes</option>
        <option value="accepted">Aceptados</option>
        <option value="observed">Con observaciones</option>
        <option value="rejected">Rechazados</option>
      </select>
    </FormField>
    <FormField label="Cliente" for="docs-customer"><BaseInput id="docs-customer" v-model="filters.customer" placeholder="Documento o nombre" /></FormField>
    <div class="col-span-2 flex items-end lg:col-span-1"><BaseButton type="submit" block :loading="loading">Filtrar</BaseButton></div>
  </form>

  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

  <template v-else>
    <EmptyState v-if="!loading && documents.length === 0" class="mt-4" title="No hay comprobantes con estos filtros" />

    <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
      <li v-for="doc in documents" :key="doc.id" data-test="document-row">
        <RouterLink :to="{ name: 'sales-document-detail', params: { id: doc.id } }" class="flex items-center justify-between gap-3 p-4 hover:bg-canvas">
          <span class="min-w-0">
            <span class="flex flex-wrap items-center gap-2 font-medium">
              {{ doc.display_number }}
              <BaseBadge :variant="documentStatusVariant[doc.status]">{{ doc.status_label }}</BaseBadge>
              <BaseBadge v-if="doc.correction_status !== 'none'" :variant="correctionVariant[doc.correction_status]" data-test="row-correction">
                {{ doc.correction_status_label }}
              </BaseBadge>
            </span>
            <span class="block truncate text-sm text-ink-muted">
              {{ formatDateTime(doc.issued_at) }} · {{ doc.customer.name }} · {{ doc.seller?.name }}
            </span>
          </span>
          <span class="font-medium">{{ formatMoney(doc.total) }}</span>
        </RouterLink>
      </li>
    </ul>

    <nav v-if="meta && meta.last_page > 1" class="mt-4 flex items-center justify-between" aria-label="Paginación">
      <BaseButton variant="secondary" :disabled="meta.current_page <= 1 || loading" @click="goTo(meta.current_page - 1)">Anterior</BaseButton>
      <span class="text-sm text-ink-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
      <BaseButton variant="secondary" :disabled="meta.current_page >= meta.last_page || loading" @click="goTo(meta.current_page + 1)">Siguiente</BaseButton>
    </nav>
  </template>
</template>
