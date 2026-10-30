<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import EstablishmentFilter from '@/shared/establishments/EstablishmentFilter.vue'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { formatDate, formatQuantity } from '@/shared/utils/format'
import { inventoryApi } from '../api'
import type { InventoryAlerts, LotAlert } from '../types'

const alerts = ref<InventoryAlerts | null>(null)
const error = ref<string | null>(null)
const establishments = useEstablishmentStore()
const establishmentFilter = ref(establishments.defaultFilter)

function daysLabel(lot: LotAlert): string {
  if (lot.days_left === 0) return 'Vence hoy'
  if (lot.days_left === 1) return 'Vence mañana'

  return `Vence en ${lot.days_left} días`
}

async function load() {
  error.value = null
  try {
    alerts.value = await inventoryApi.alerts(establishmentFilter.value)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudieron cargar las alertas.'
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-xl font-semibold">Alertas de inventario</h1>
    <!-- Un producto bajo el mínimo sale una vez por local (spec 017). -->
    <div class="w-full sm:w-64"><EstablishmentFilter id="alerts-establishment" v-model="establishmentFilter" @change="load" /></div>
  </div>

  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

  <template v-else-if="alerts">
    <section class="mt-6" aria-labelledby="low-title">
      <h2 id="low-title" class="text-lg font-semibold">Stock bajo</h2>
      <EmptyState v-if="alerts.low_stock.length === 0" class="mt-3" title="Ningún producto por debajo de su mínimo" />
      <ul v-else class="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        <li v-for="item in alerts.low_stock" :key="`${item.id}-${item.establishment.id}`" data-test="low-stock-row">
          <RouterLink :to="{ name: 'product-detail', params: { id: item.id } }" class="flex items-center justify-between gap-3 p-4 hover:bg-canvas">
            <span class="min-w-0">
              <span class="block truncate font-medium">{{ item.name }}</span>
              <span class="text-sm text-ink-muted">{{ item.code }}<template v-if="establishments.multi"> · {{ item.establishment.name }}</template></span>
            </span>
            <span class="text-right text-sm">
              <span class="block font-medium">{{ formatQuantity(item.available_stock) }} disponibles</span>
              <span class="text-ink-muted">mínimo {{ formatQuantity(item.min_stock) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <section class="mt-8" aria-labelledby="expiring-title">
      <h2 id="expiring-title" class="text-lg font-semibold">Próximos a vencer</h2>
      <EmptyState v-if="alerts.expiring.length === 0" class="mt-3" title="Ningún lote vence pronto" />
      <ul v-else class="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        <li v-for="lot in alerts.expiring" :key="lot.id" data-test="expiring-row">
          <RouterLink :to="{ name: 'product-detail', params: { id: lot.product.id } }" class="flex items-center justify-between gap-3 p-4 hover:bg-canvas">
            <span class="min-w-0">
              <span class="block truncate font-medium">{{ lot.product.name }}</span>
              <span class="text-sm text-ink-muted">
                Lote {{ lot.lot_number }} · {{ formatQuantity(lot.remaining_quantity) }} en stock<template v-if="establishments.multi"> · {{ lot.establishment.name }}</template>
              </span>
            </span>
            <span class="text-right text-sm">
              <BaseBadge :variant="lot.days_left <= 7 ? 'danger' : 'warning'">{{ daysLabel(lot) }}</BaseBadge>
              <span class="block text-ink-muted">{{ formatDate(lot.expires_at) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <section v-if="alerts.expired.length > 0" class="mt-8" aria-labelledby="expired-title">
      <h2 id="expired-title" class="text-lg font-semibold">Vencidos con saldo</h2>
      <p class="text-sm text-ink-muted">No se pueden vender. Regulariza su saldo con un ajuste por vencimiento.</p>
      <ul class="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        <li v-for="lot in alerts.expired" :key="lot.id" data-test="expired-row">
          <RouterLink :to="{ name: 'product-detail', params: { id: lot.product.id } }" class="flex items-center justify-between gap-3 p-4 hover:bg-canvas">
            <span class="min-w-0">
              <span class="block truncate font-medium">{{ lot.product.name }}</span>
              <span class="text-sm text-ink-muted">
                Lote {{ lot.lot_number }} · {{ formatQuantity(lot.remaining_quantity) }} en stock<template v-if="establishments.multi"> · {{ lot.establishment.name }}</template>
              </span>
            </span>
            <BaseBadge variant="danger">Venció {{ formatDate(lot.expires_at) }}</BaseBadge>
          </RouterLink>
        </li>
      </ul>
    </section>
  </template>
</template>
