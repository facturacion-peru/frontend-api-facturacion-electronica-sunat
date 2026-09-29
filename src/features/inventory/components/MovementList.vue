<script setup lang="ts">
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { formatDateTime, formatQuantity } from '@/shared/utils/format'
import { useInventoryCatalogs } from '../composables/useInventoryCatalogs'
import { movementLabels, type Movement } from '../types'

defineProps<{ movements: Movement[] }>()
defineEmits<{ reverse: [movement: Movement] }>()

const { reasonLabel } = useInventoryCatalogs()

function canReverse(movement: Movement): boolean {
  return !movement.reversed && movement.type !== 'reversal'
}
</script>

<template>
  <EmptyState v-if="movements.length === 0" title="Sin movimientos" />

  <ol v-else class="divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="movement in movements" :key="movement.id" class="flex flex-col gap-2 p-4 sm:flex-row sm:items-center" data-test="movement-row">
      <div class="min-w-0 flex-1">
        <p class="flex flex-wrap items-center gap-2">
          <span class="font-medium">{{ movementLabels[movement.type] }}</span>
          <span :class="movement.quantity.startsWith('-') ? 'text-red-700' : 'text-green-700'" class="font-medium">
            {{ movement.quantity.startsWith('-') ? '' : '+' }}{{ formatQuantity(movement.quantity) }}
          </span>
          <BaseBadge v-if="movement.reversed" variant="neutral">Revertido</BaseBadge>
        </p>
        <p class="text-sm text-ink-muted">
          Lote {{ movement.lot.lot_number }} · Saldo {{ formatQuantity(movement.product_balance_after) }}
          <template v-if="movement.reason"> · {{ reasonLabel(movement.reason) }}</template>
        </p>
        <p class="text-xs text-ink-muted">
          {{ formatDateTime(movement.created_at) }} · {{ movement.created_by?.name ?? 'Sistema' }}
          <template v-if="movement.note"> · {{ movement.note }}</template>
        </p>
      </div>
      <button
        v-if="canReverse(movement)"
        type="button"
        class="min-h-11 self-start rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:self-center"
        @click="$emit('reverse', movement)"
      >
        Revertir
      </button>
    </li>
  </ol>
</template>
