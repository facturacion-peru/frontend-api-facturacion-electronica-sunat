<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import BaseBadge from '@/shared/ui/BaseBadge.vue'
import { formatMoney } from '@/shared/utils/format'
import { documentTypeLabels, saleStatus, type RecentSale } from '../types'

/** Últimas ventas (HU-3), tickets y comprobantes juntos. */
defineProps<{ sales: RecentSale[] }>()

const when = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function link(sale: RecentSale): RouteLocationRaw {
  return sale.kind === 'ticket'
    ? { name: 'ticket-detail', params: { id: sale.id } }
    : { name: 'sales-document-detail', params: { id: sale.id } }
}

function title(sale: RecentSale): string {
  return sale.kind === 'ticket' ? `Ticket ${sale.number}` : `${documentTypeLabels[sale.document_type ?? ''] ?? ''} ${sale.number}`.trim()
}
</script>

<template>
  <section aria-labelledby="recent-title" class="rounded-2xl border border-line bg-surface p-5 shadow-xs">
    <div class="flex items-center justify-between gap-3">
      <h2 id="recent-title" class="text-sm font-medium text-ink-muted">Últimas ventas</h2>
      <RouterLink v-if="sales.length" :to="{ name: 'tickets' }" class="text-sm font-medium text-brand-700 hover:underline">Ver todas</RouterLink>
    </div>

    <ul v-if="sales.length" class="mt-2 -mx-2 divide-y divide-line">
      <li v-for="sale in sales" :key="`${sale.kind}-${sale.id}`">
        <RouterLink :to="link(sale)" class="flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-subtle">
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium text-ink">{{ title(sale) }}</span>
            <span class="block truncate text-xs text-ink-muted">
              {{ when.format(new Date(sale.issued_at)) }} · {{ sale.customer_name ?? 'Sin cliente' }}
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="block text-sm font-semibold text-ink">{{ formatMoney(sale.total) }}</span>
            <BaseBadge :variant="saleStatus[sale.status]?.variant ?? 'neutral'">{{ saleStatus[sale.status]?.label ?? sale.status }}</BaseBadge>
          </span>
        </RouterLink>
      </li>
    </ul>

    <p v-else class="mt-3 text-sm text-ink-muted">
      Aún no hay ventas.
      <RouterLink :to="{ name: 'new-sale' }" class="font-medium text-brand-700 hover:underline">Registra tu primera venta</RouterLink>.
    </p>
  </section>
</template>
