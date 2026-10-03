<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { onMounted, reactive, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import SearchInput from '@/shared/ui/SearchInput.vue'
import { platformApi } from '../api'
import { sunatVariant, type CompanyFilters, type PlatformCompany } from '../types'

/** Empresas del SaaS con su estado (spec 006, HU-1, CE-003). */
const filters = reactive<CompanyFilters>({ search: '', status: '', issues: false, page: 1 })
const companies = ref<PlatformCompany[]>([])
const meta = ref<PaginationMeta | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const page = await platformApi.companies(filters)
    companies.value = page.data
    meta.value = page.meta
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudieron cargar las empresas.'
  } finally {
    loading.value = false
  }
}

function apply() {
  filters.page = 1
  load()
}

const onSearch = useDebounceFn(apply, 250)

function goTo(page: number) {
  filters.page = page
  load()
}

onMounted(load)
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-xl font-semibold">Empresas</h1>
    <RouterLink :to="{ name: 'platform-company-create' }"><BaseButton tabindex="-1">Nueva empresa</BaseButton></RouterLink>
  </div>

  <div class="mt-4 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_12rem_auto]">
    <div>
      <label for="companies-search" class="sr-only">Buscar empresa</label>
      <SearchInput id="companies-search" v-model="filters.search" placeholder="RUC o razón social" autocomplete="off" @input="onSearch" @clear="apply" />
    </div>
    <div>
      <label for="companies-status" class="sr-only">Estado</label>
      <BaseSelect id="companies-status" v-model="filters.status" @change="apply">
        <option value="">Todas</option>
        <option value="active">Activas</option>
        <option value="inactive">Suspendidas</option>
      </BaseSelect>
    </div>
    <label class="flex min-h-11 items-center gap-2 text-sm">
      <input id="companies-issues" v-model="filters.issues" type="checkbox" class="size-4" @change="apply" />
      Con problemas de emisión
    </label>
  </div>

  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

  <EmptyState v-else-if="!loading && companies.length === 0" class="mt-4" title="No hay empresas con estos filtros" />

  <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="c in companies" :key="c.id" data-test="company-row">
      <RouterLink :to="{ name: 'platform-company', params: { id: c.id } }" class="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-canvas">
        <span class="min-w-0">
          <span class="flex flex-wrap items-center gap-2 font-medium">
            {{ c.razon_social }}
            <BaseBadge v-if="!c.active" variant="danger">Suspendida</BaseBadge>
          </span>
          <span class="block text-sm text-ink-muted">RUC {{ c.ruc }} · {{ c.users_count }} usuario{{ c.users_count === 1 ? '' : 's' }}</span>
        </span>
        <span class="flex flex-wrap items-center gap-2 text-sm">
          <BaseBadge :variant="sunatVariant[c.sunat_status]">SUNAT: {{ c.sunat_status_label }}</BaseBadge>
          <BaseBadge v-if="c.pending_documents" variant="warning" data-test="pending">{{ c.pending_documents }} pendiente{{ c.pending_documents === 1 ? '' : 's' }}</BaseBadge>
          <BaseBadge v-if="c.rejected_documents" variant="danger" data-test="rejected">{{ c.rejected_documents }} rechazado{{ c.rejected_documents === 1 ? '' : 's' }}</BaseBadge>
        </span>
      </RouterLink>
    </li>
  </ul>

  <nav v-if="meta && meta.last_page > 1" class="mt-4 flex items-center justify-between" aria-label="Paginación">
    <BaseButton variant="secondary" :disabled="meta.current_page <= 1 || loading" @click="goTo(meta.current_page - 1)">Anterior</BaseButton>
    <span class="text-sm text-ink-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
    <BaseButton variant="secondary" :disabled="meta.current_page >= meta.last_page || loading" @click="goTo(meta.current_page + 1)">Siguiente</BaseButton>
  </nav>
</template>
