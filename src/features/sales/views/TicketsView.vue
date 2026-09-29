<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import type { PaginationMeta } from '@/core/api/types'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatDateTime, formatMoney, today } from '@/shared/utils/format'
import { salesApi } from '../api'
import SalesTabs from '../components/SalesTabs.vue'
import { paymentLabels, type Ticket, type TicketFilters, type TicketTotals } from '../types'

const filters = reactive<TicketFilters>({ from: today(), to: today(), status: '', payment_method: '', page: 1 })
const tickets = ref<Ticket[]>([])
const meta = ref<PaginationMeta | null>(null)
const totals = ref<TicketTotals | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const selectClass = 'block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base sm:text-sm'

async function load() {
  loading.value = true
  error.value = null
  try {
    const page = await salesApi.list(filters)
    tickets.value = page.data
    meta.value = page.meta
    totals.value = page.totals
  } catch (e) {
    error.value = e instanceof ApiError ? (Object.values(e.fieldErrors)[0]?.[0] ?? e.message) : 'No se pudieron cargar las ventas.'
  } finally {
    loading.value = false
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

onMounted(load)
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-xl font-semibold">Ventas</h1>
    <RouterLink :to="{ name: 'new-sale' }"><BaseButton tabindex="-1">Nueva venta</BaseButton></RouterLink>
  </div>
  <SalesTabs />

  <form class="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 lg:grid-cols-5" @submit.prevent="apply">
    <FormField label="Desde" for="sales-from"><BaseInput id="sales-from" v-model="filters.from" type="date" /></FormField>
    <FormField label="Hasta" for="sales-to"><BaseInput id="sales-to" v-model="filters.to" type="date" /></FormField>
    <FormField label="Estado" for="sales-status">
      <select id="sales-status" v-model="filters.status" :class="selectClass">
        <option value="">Todos</option>
        <option value="issued">Emitidos</option>
        <option value="voided">Anulados</option>
      </select>
    </FormField>
    <FormField label="Medio de pago" for="sales-method">
      <select id="sales-method" v-model="filters.payment_method" :class="selectClass">
        <option value="">Todos</option>
        <option v-for="(label, value) in paymentLabels" :key="value" :value="value">{{ label }}</option>
      </select>
    </FormField>
    <div class="col-span-2 flex items-end lg:col-span-1"><BaseButton type="submit" block :loading="loading">Filtrar</BaseButton></div>
  </form>

  <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

  <template v-else>
    <dl v-if="totals" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5" data-test="sales-totals">
      <div class="col-span-2 rounded-xl border border-line bg-surface p-4 sm:col-span-1">
        <dt class="text-xs text-ink-muted">Total ({{ totals.count }} ventas)</dt>
        <dd class="mt-1 text-lg font-semibold">{{ formatMoney(totals.total) }}</dd>
      </div>
      <div v-for="(amount, method) in totals.by_payment_method" :key="method" class="rounded-xl border border-line bg-surface p-4">
        <dt class="text-xs text-ink-muted">{{ paymentLabels[method] }}</dt>
        <dd class="mt-1 font-semibold">{{ formatMoney(amount) }}</dd>
      </div>
    </dl>

    <EmptyState v-if="!loading && tickets.length === 0" class="mt-4" title="No hay ventas en estas fechas" />

    <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
      <li v-for="ticket in tickets" :key="ticket.id" data-test="ticket-row">
        <RouterLink :to="{ name: 'ticket-detail', params: { id: ticket.id } }" class="flex items-center justify-between gap-3 p-4 hover:bg-canvas">
          <span class="min-w-0">
            <span class="flex items-center gap-2 font-medium">
              {{ ticket.display_number }}
              <BaseBadge v-if="ticket.status === 'voided'" variant="danger">Anulado</BaseBadge>
            </span>
            <span class="block truncate text-sm text-ink-muted">
              {{ formatDateTime(ticket.issued_at) }} · {{ ticket.seller?.name }} · {{ paymentLabels[ticket.payment_method] }}
            </span>
          </span>
          <span class="font-medium" :class="ticket.status === 'voided' && 'text-ink-muted line-through'">{{ formatMoney(ticket.total) }}</span>
        </RouterLink>
      </li>
    </ul>

    <nav v-if="meta && meta.last_page > 1" class="mt-4 flex items-center justify-between" aria-label="Paginación">
      <BaseButton variant="secondary" :disabled="meta.current_page <= 1 || loading" @click="goTo(meta.current_page - 1)">Anterior</BaseButton>
      <span class="text-sm text-ink-muted">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
      <BaseButton variant="secondary" :disabled="meta.current_page >= meta.last_page || loading" @click="goTo(meta.current_page + 1)">Siguiente</BaseButton>
    </nav>
  </template>
</template>
