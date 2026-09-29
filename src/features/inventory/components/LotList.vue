<script setup lang="ts">
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { formatDate, formatMoney, formatQuantity } from '@/shared/utils/format'
import type { Lot } from '../types'

defineProps<{ lots: Lot[]; canAdjust: boolean }>()
defineEmits<{ adjust: [lot: Lot] }>()
</script>

<template>
  <EmptyState v-if="lots.length === 0" title="Sin lotes con saldo" description="Registra una entrada de mercadería." />

  <ul v-else class="divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="lot in lots" :key="lot.id" class="flex flex-col gap-2 p-4 sm:flex-row sm:items-center" data-test="lot-row">
      <div class="min-w-0 flex-1">
        <p class="flex flex-wrap items-center gap-2 font-medium">
          <span>Lote {{ lot.lot_number }}</span>
          <BaseBadge v-if="lot.expired" variant="danger">Vencido</BaseBadge>
        </p>
        <p class="text-sm text-ink-muted">
          Ingreso {{ formatDate(lot.received_at) }}
          <template v-if="lot.expires_at"> · Vence {{ formatDate(lot.expires_at) }}</template>
          <template v-if="lot.unit_cost != null"> · Costo {{ formatMoney(lot.unit_cost) }}</template>
        </p>
        <p v-if="lot.reference" class="text-xs text-ink-muted">{{ lot.reference }}</p>
      </div>
      <div class="flex items-center gap-3">
        <p class="text-right">
          <span class="block font-medium">{{ formatQuantity(lot.remaining_quantity) }}</span>
          <span class="text-xs text-ink-muted">de {{ formatQuantity(lot.initial_quantity) }}</span>
        </p>
        <button
          v-if="canAdjust"
          type="button"
          class="min-h-11 rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
          @click="$emit('adjust', lot)"
        >
          Ajustar
        </button>
      </div>
    </li>
  </ul>
</template>
