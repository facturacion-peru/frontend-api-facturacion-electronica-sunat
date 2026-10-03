<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import FormField from '@/shared/ui/FormField.vue'
import { auditApi } from '../api'
import { actionLabels, type AuditEntry, type AuditFilters } from '../types'

const filters = reactive<AuditFilters>({ action: '', actor_id: '', from: '', to: '', page: 1 })
const entries = ref<AuditEntry[]>([])
const meta = ref<PaginationMeta | null>(null)
const users = ref<{ id: number; name: string }[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

async function load() {
  loading.value = true
  error.value = null
  try {
    const page = await auditApi.list(filters)
    entries.value = page.data
    meta.value = page.meta
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.fieldErrors)[0]?.[0] ?? e.message) : 'No se pudo cargar la auditoría.'
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  filters.page = 1
  load()
}

function goTo(page: number) {
  filters.page = page
  load()
}

function describeChanges(changes: AuditEntry['changes']): string {
  if (!changes) return ''
  return Object.entries(changes)
    .map(([field, value]) =>
      value && typeof value === 'object' && 'to' in value ? `${field}: ${String((value as { to: unknown }).to)}` : `${field}: ${String(value)}`,
    )
    .join(' · ')
}

onMounted(async () => {
  await load()
  users.value = await auditApi.users().catch(() => [])
})
</script>

<template>
  <h1 class="text-xl font-semibold">Auditoría</h1>

  <form class="mt-4 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5" @submit.prevent="applyFilters">
    <FormField label="Acción" for="filter-action">
      <BaseSelect id="filter-action" v-model="filters.action">
        <option value="">Todas</option>
        <option v-for="(label, value) in actionLabels" :key="value" :value="value">{{ label }}</option>
      </BaseSelect>
    </FormField>
    <FormField label="Usuario" for="filter-actor">
      <BaseSelect id="filter-actor" v-model="filters.actor_id">
        <option value="">Todos</option>
        <option v-for="user in users" :key="user.id" :value="String(user.id)">{{ user.name }}</option>
      </BaseSelect>
    </FormField>
    <FormField label="Desde" for="filter-from">
      <BaseInput id="filter-from" v-model="filters.from" type="date" />
    </FormField>
    <FormField label="Hasta" for="filter-to">
      <BaseInput id="filter-to" v-model="filters.to" type="date" />
    </FormField>
    <div class="flex items-end">
      <BaseButton type="submit" block :loading="loading">Filtrar</BaseButton>
    </div>
  </form>

  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

  <EmptyState v-else-if="!loading && entries.length === 0" class="mt-4" title="Sin registros" description="Prueba con otros filtros." />

  <ol v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="entry in entries" :key="entry.id" class="p-4" data-test="audit-row">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="font-medium">{{ actionLabels[entry.action] ?? entry.action }}</p>
        <time class="text-xs text-ink-muted" :datetime="entry.created_at">{{ dateFormat.format(new Date(entry.created_at)) }}</time>
      </div>
      <p class="text-sm text-ink-muted">
        {{ entry.actor?.name ?? 'Sistema' }}<span v-if="entry.ip"> · {{ entry.ip }}</span>
      </p>
      <p v-if="entry.changes" class="mt-1 text-xs break-words text-ink-muted">{{ describeChanges(entry.changes) }}</p>
    </li>
  </ol>

  <nav v-if="meta && meta.last_page > 1" class="mt-4 flex items-center justify-between" aria-label="Paginación">
    <BaseButton variant="secondary" :disabled="meta.current_page <= 1 || loading" @click="goTo(meta.current_page - 1)">Anterior</BaseButton>
    <span class="text-sm text-ink-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
    <BaseButton variant="secondary" :disabled="meta.current_page >= meta.last_page || loading" @click="goTo(meta.current_page + 1)">Siguiente</BaseButton>
  </nav>
</template>
