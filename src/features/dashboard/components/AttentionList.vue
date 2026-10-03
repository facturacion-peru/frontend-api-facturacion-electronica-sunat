<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { DashboardSummary } from '../types'

/** Lo que requiere atención (HU-2), cada cosa enlazada a su listado filtrado. */
const props = defineProps<{ attention: DashboardSummary['attention'] }>()

interface Item {
  key: string
  text: string
  to: RouteLocationRaw
  tone: 'warning' | 'danger'
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const items = computed<Item[]>(() => {
  const { pending_documents: pending, rejected_documents: rejected, inventory_alerts: alerts } = props.attention
  const list: Item[] = []

  if (pending > 0) {
    list.push({
      key: 'pending',
      text: plural(pending, 'comprobante por enviar a SUNAT', 'comprobantes por enviar a SUNAT'),
      to: { name: 'sales-documents', query: { status: 'pending' } },
      tone: 'warning',
    })
  }
  if (rejected > 0) {
    list.push({
      key: 'rejected',
      text: plural(rejected, 'comprobante rechazado', 'comprobantes rechazados'),
      to: { name: 'sales-documents', query: { status: 'rejected' } },
      tone: 'danger',
    })
  }
  if (alerts) {
    list.push({
      key: 'alerts',
      text: plural(alerts, 'alerta de inventario', 'alertas de inventario'),
      to: { name: 'inventory-alerts' },
      tone: 'warning',
    })
  }

  return list
})

const tones = {
  warning: 'bg-warning-100 text-warning-800',
  danger: 'bg-danger-100 text-danger-800',
}
</script>

<template>
  <section aria-labelledby="attention-title" class="rounded-2xl border border-line bg-surface p-5 shadow-xs">
    <h2 id="attention-title" class="text-sm font-medium text-ink-muted">Por atender</h2>

    <ul v-if="items.length" class="mt-2 -mx-2">
      <li v-for="item in items" :key="item.key">
        <RouterLink :to="item.to" class="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink hover:bg-subtle">
          <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full" :class="tones[item.tone]" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
          <span class="min-w-0 flex-1 font-medium">{{ item.text }}</span>
          <span aria-hidden="true" class="text-ink-muted">›</span>
        </RouterLink>
      </li>
    </ul>

    <p v-else class="mt-3 flex items-center gap-3 text-sm text-ink">
      <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-800" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4">
          <path
            fill-rule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
            clip-rule="evenodd"
          />
        </svg>
      </span>
      <span><span class="font-medium">Todo al día.</span> No hay comprobantes ni alertas pendientes.</span>
    </p>
  </section>
</template>
