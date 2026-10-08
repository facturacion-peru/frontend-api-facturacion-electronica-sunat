<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { onMounted, reactive, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import { useSessionStore } from '@/core/auth/session-store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ExportButton from '@/shared/ui/ExportButton.vue'
import SearchInput from '@/shared/ui/SearchInput.vue'
import { formatMoney, formatQuantity } from '@/shared/utils/format'
import { inventoryApi } from '../api'
import { useInventoryCatalogs } from '../composables/useInventoryCatalogs'
import type { Product, ProductFilters } from '../types'

const session = useSessionStore()
const { load: loadCatalogs, unitLabel } = useInventoryCatalogs()

const filters = reactive<ProductFilters>({ search: '', type: '', status: 'active', page: 1 })
const products = ref<Product[]>([])
const meta = ref<PaginationMeta | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const exportLots = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    const page = await inventoryApi.listProducts(filters)
    products.value = page.data
    meta.value = page.meta
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo cargar el catálogo.'
  } finally {
    loading.value = false
  }
}

const search = useDebounceFn(() => {
  filters.page = 1
  load()
}, 300)

function applyFilters() {
  filters.page = 1
  load()
}

function goTo(page: number) {
  filters.page = page
  load()
}

function isLowStock(product: Product): boolean {
  return product.min_stock !== null && product.available_stock !== null && Number(product.available_stock) <= Number(product.min_stock)
}

onMounted(() => {
  loadCatalogs()
  load()
})
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-xl font-semibold">Productos</h1>
    <div v-if="session.isCompanyAdmin" class="flex flex-wrap gap-2">
      <ExportButton title="Exportar productos" :download="(format) => inventoryApi.exportProducts(filters, format, exportLots)">
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input v-model="exportLots" type="checkbox" class="size-4" data-test="export-lots" />
          Incluir una hoja con los lotes (costo y vencimiento)
        </label>
      </ExportButton>
      <RouterLink :to="{ name: 'product-create' }">
        <BaseButton tabindex="-1">Nuevo producto</BaseButton>
      </RouterLink>
    </div>
  </div>

  <div class="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
    <label for="product-search" class="sr-only">Buscar por código o nombre</label>
    <SearchInput id="product-search" v-model="filters.search" placeholder="Buscar por código o nombre" @input="search" @clear="applyFilters" />
    <label for="product-type" class="sr-only">Tipo</label>
    <BaseSelect id="product-type" v-model="filters.type" @change="applyFilters">
      <option value="">Bienes y servicios</option>
      <option value="good">Solo bienes</option>
      <option value="service">Solo servicios</option>
    </BaseSelect>
    <template v-if="session.isCompanyAdmin">
      <label for="product-status" class="sr-only">Estado</label>
      <BaseSelect id="product-status" v-model="filters.status" @change="applyFilters">
        <option value="active">Activos</option>
        <option value="inactive">Desactivados</option>
        <option value="all">Todos</option>
      </BaseSelect>
    </template>
  </div>

  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

  <p v-else-if="loading && products.length === 0" class="mt-6 text-sm text-ink-muted">Cargando…</p>

  <EmptyState
    v-else-if="products.length === 0"
    class="mt-4"
    title="No hay productos"
    :description="filters.search ? 'Prueba con otra búsqueda.' : 'Registra tu primer producto para empezar.'"
  />

  <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="product in products" :key="product.id" data-test="product-row">
      <RouterLink :to="{ name: 'product-detail', params: { id: product.id } }" class="flex items-center gap-3 p-4 hover:bg-canvas">
        <div class="min-w-0 flex-1">
          <p class="flex flex-wrap items-center gap-2 font-medium">
            <span class="truncate">{{ product.name }}</span>
            <BaseBadge v-if="!product.active" variant="neutral">Desactivado</BaseBadge>
            <BaseBadge v-if="product.type === 'service'" variant="info">Servicio</BaseBadge>
            <BaseBadge v-if="isLowStock(product)" variant="warning">Stock bajo</BaseBadge>
          </p>
          <p class="text-sm text-ink-muted">{{ product.code }} · {{ unitLabel(product.unit) }}</p>
        </div>
        <div class="text-right">
          <p class="font-medium">{{ formatMoney(product.sale_price) }}</p>
          <p v-if="product.available_stock !== null" class="text-sm text-ink-muted">
            Disp. {{ formatQuantity(product.available_stock) }}
          </p>
        </div>
      </RouterLink>
    </li>
  </ul>

  <nav v-if="meta && meta.last_page > 1" class="mt-4 flex items-center justify-between" aria-label="Paginación">
    <BaseButton variant="secondary" :disabled="meta.current_page <= 1 || loading" @click="goTo(meta.current_page - 1)">Anterior</BaseButton>
    <span class="text-sm text-ink-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
    <BaseButton variant="secondary" :disabled="meta.current_page >= meta.last_page || loading" @click="goTo(meta.current_page + 1)">Siguiente</BaseButton>
  </nav>
</template>
