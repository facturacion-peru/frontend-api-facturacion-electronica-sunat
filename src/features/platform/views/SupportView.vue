<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { formatDateTime } from '@/shared/utils/format'
import { platformApi } from '../api'
import type { SupportDocument } from '../types'

/** Soporte de la emisión (spec 006, HU-5): solo datos de envío (A-37). */
const route = useRoute()
const filters = reactive<{ status: '' | 'pending' | 'rejected'; company_id: number | null; page: number }>({
  status: '', company_id: route.query.empresa ? Number(route.query.empresa) : null, page: 1,
})
const documents = ref<SupportDocument[]>([])
const meta = ref<PaginationMeta | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const busyId = ref<number | null>(null)

async function load() {
  try {
    const page = await platformApi.supportDocuments(filters)
    documents.value = page.data
    meta.value = page.meta
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudieron cargar los comprobantes.'
  }
}

async function retry(doc: SupportDocument) {
  busyId.value = doc.id
  error.value = null
  notice.value = null
  try {
    const result = await platformApi.retry(doc.id)
    notice.value = `${doc.display_number} de ${doc.company.razon_social}: ${result.status_label}.`
    await load()
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    error.value = Object.values(e.fieldErrors)[0]?.[0] ?? e.message
  } finally {
    busyId.value = null
  }
}

function apply() {
  filters.page = 1
  load()
}

function allCompanies() {
  filters.company_id = null
  apply()
}

onMounted(load)
</script>

<template>
  <h1 class="text-xl font-semibold">Soporte de la emisión</h1>
  <p class="mt-1 text-sm text-ink-muted">Comprobantes pendientes o rechazados de todas las empresas. Solo datos de envío.</p>

  <div class="mt-4 flex flex-wrap items-end gap-3">
    <div class="w-48">
      <label for="support-status" class="text-sm font-medium">Estado</label>
      <BaseSelect id="support-status" v-model="filters.status" @change="apply">
        <option value="">Pendientes y rechazados</option>
        <option value="pending">Pendientes</option>
        <option value="rejected">Rechazados</option>
      </BaseSelect>
    </div>
    <BaseButton v-if="filters.company_id" variant="secondary" @click="allCompanies">Ver todas las empresas</BaseButton>
  </div>

  <BaseAlert v-if="notice" variant="success" class="mt-4">{{ notice }}</BaseAlert>
  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

  <EmptyState v-if="documents.length === 0 && !error" class="mt-4" title="No hay comprobantes con problemas" />

  <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="doc in documents" :key="doc.id" class="flex flex-wrap items-center justify-between gap-3 p-4 text-sm" data-test="support-row">
      <div class="min-w-0">
        <p class="flex flex-wrap items-center gap-2 font-medium">
          {{ doc.display_number }}
          <BaseBadge :variant="doc.status === 'rejected' ? 'danger' : 'warning'">{{ doc.status_label }}</BaseBadge>
        </p>
        <p class="text-ink-muted">{{ doc.company.razon_social }} · RUC {{ doc.company.ruc }}</p>
        <p class="text-ink-muted">
          {{ formatDateTime(doc.issued_at) }} · {{ doc.attempts }} intento{{ doc.attempts === 1 ? '' : 's' }}
          <template v-if="doc.sunat_code"> · {{ doc.sunat_code }}</template><template v-if="doc.sunat_message">: {{ doc.sunat_message }}</template>
        </p>
      </div>
      <BaseButton v-if="doc.can_retry" variant="secondary" :loading="busyId === doc.id" @click="retry(doc)">Reintentar</BaseButton>
    </li>
  </ul>
</template>
