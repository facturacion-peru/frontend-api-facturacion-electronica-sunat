<script setup lang="ts">
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import type { Series } from '../types'

/** Series de un tipo (y, con varios locales, de un local) con su correlativo y «Activar/Desactivar». */
defineProps<{ items: Series[]; busyId: number | null }>()
defineEmits<{ toggle: [item: Series] }>()
</script>

<template>
  <ul class="divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="item in items" :key="item.id" class="flex flex-wrap items-center justify-between gap-3 p-4" :data-test="`series-${item.code}`">
      <div>
        <p class="font-mono font-medium">
          {{ item.code }}
          <BaseBadge v-if="!item.active" class="ml-1 font-sans">Desactivada</BaseBadge>
        </p>
        <p class="text-sm text-ink-muted">
          Último número: {{ item.last_number }} · Siguiente: <span class="font-medium text-ink">{{ item.next_number }}</span>
        </p>
      </div>
      <BaseButton variant="secondary" :loading="busyId === item.id" @click="$emit('toggle', item)">
        {{ item.active ? 'Desactivar' : 'Activar' }}
      </BaseButton>
    </li>
  </ul>
</template>
