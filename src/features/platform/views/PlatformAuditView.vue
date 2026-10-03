<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { formatDateTime } from '@/shared/utils/format'
import { platformApi } from '../api'
import { auditActionLabels, type PlatformAuditEntry } from '../types'

/** Auditoría de la plataforma (spec 006, HU-6). */
const filters = reactive({ action: '', page: 1 })
const entries = ref<PlatformAuditEntry[]>([])
const meta = ref<PaginationMeta | null>(null)
const error = ref<string | null>(null)

async function load() {
  try {
    const page = await platformApi.audit(filters)
    entries.value = page.data
    meta.value = page.meta
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo cargar la auditoría.'
  }
}

function apply() {
  filters.page = 1
  load()
}

function goTo(page: number) {
  filters.page = page
  load()
}

function detail(entry: PlatformAuditEntry): string {
  const reason = entry.changes?.reason
  if (typeof reason === 'string') return `Motivo: ${reason}`
  if (entry.changes && entry.action === 'company.updated') return `Cambió: ${Object.keys(entry.changes).join(', ')}`

  return ''
}

onMounted(load)
</script>

<template>
  <h1 class="text-xl font-semibold">Auditoría de la plataforma</h1>

  <div class="mt-4 w-64">
    <label for="audit-action" class="text-sm font-medium">Acción</label>
    <BaseSelect id="audit-action" v-model="filters.action" @change="apply">
      <option value="">Todas</option>
      <option v-for="(label, value) in auditActionLabels" :key="value" :value="value">{{ label }}</option>
    </BaseSelect>
  </div>

  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>
  <EmptyState v-else-if="entries.length === 0" class="mt-4" title="Sin acciones registradas" />

  <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="entry in entries" :key="entry.id" class="p-4 text-sm" data-test="audit-row">
      <p class="font-medium">{{ auditActionLabels[entry.action] ?? entry.action }}<template v-if="entry.company"> · {{ entry.company.razon_social }}</template></p>
      <p class="text-ink-muted">{{ formatDateTime(entry.created_at) }} · {{ entry.actor?.name }}<template v-if="entry.ip"> · {{ entry.ip }}</template></p>
      <p v-if="detail(entry)" class="text-ink-muted">{{ detail(entry) }}</p>
    </li>
  </ul>

  <nav v-if="meta && meta.last_page > 1" class="mt-4 flex items-center justify-between" aria-label="Paginación">
    <BaseButton variant="secondary" :disabled="meta.current_page <= 1" @click="goTo(meta.current_page - 1)">Anterior</BaseButton>
    <span class="text-sm text-ink-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
    <BaseButton variant="secondary" :disabled="meta.current_page >= meta.last_page" @click="goTo(meta.current_page + 1)">Siguiente</BaseButton>
  </nav>
</template>
