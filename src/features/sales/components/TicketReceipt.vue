<script setup lang="ts">
import { formatDateTime, formatMoney, formatQuantity } from '@/shared/utils/format'
import { paymentLabels, type Ticket } from '../types'

defineProps<{ ticket: Ticket; companyName: string; companyRuc: string }>()
</script>

<template>
  <article class="print-area mx-auto w-full max-w-[80mm] rounded-xl border border-line bg-white p-4 font-mono text-[12px] leading-snug text-black">
    <p v-if="ticket.status === 'voided'" class="mb-2 border-2 border-red-700 py-1 text-center text-sm font-bold text-red-700" data-test="voided-banner">
      ANULADO
    </p>
    <header class="text-center">
      <p class="text-sm font-bold">{{ companyName }}</p>
      <p>RUC {{ companyRuc }}</p>
      <p class="mt-2 font-bold">TICKET {{ ticket.display_number }}</p>
      <p>{{ formatDateTime(ticket.issued_at) }}</p>
    </header>

    <p class="mt-2 border-y border-dashed border-black py-1 text-center font-bold" data-test="legal-notice">{{ ticket.legal_notice }}</p>

    <dl class="mt-2 space-y-0.5">
      <div class="flex justify-between gap-2"><dt>Cliente</dt><dd class="text-right">{{ ticket.customer_label }}</dd></div>
      <div v-if="ticket.customer_document" class="flex justify-between gap-2"><dt>Doc.</dt><dd>{{ ticket.customer_document }}</dd></div>
      <div v-if="ticket.seller" class="flex justify-between gap-2"><dt>Atendió</dt><dd class="text-right">{{ ticket.seller.name }}</dd></div>
    </dl>

    <ul class="mt-2 border-t border-dashed border-black pt-2">
      <li v-for="(line, i) in ticket.lines ?? []" :key="i" class="mb-1">
        <p>{{ line.product_name }}</p>
        <p class="flex justify-between gap-2">
          <span>{{ formatQuantity(line.quantity) }} × {{ formatMoney(line.unit_price) }}</span>
          <span>{{ formatMoney(line.gross_amount) }}</span>
        </p>
        <p v-if="line.discount !== '0.00'" class="flex justify-between gap-2"><span>Descuento</span><span>−{{ formatMoney(line.discount) }}</span></p>
      </li>
    </ul>

    <dl class="mt-2 space-y-0.5 border-t border-dashed border-black pt-2">
      <div v-if="ticket.discount_total !== '0.00'" class="flex justify-between"><dt>Descuentos</dt><dd>−{{ formatMoney(ticket.discount_total) }}</dd></div>
      <div class="flex justify-between text-sm font-bold"><dt>TOTAL</dt><dd>{{ formatMoney(ticket.total) }}</dd></div>
      <div class="flex justify-between"><dt>Pago</dt><dd>{{ paymentLabels[ticket.payment_method] }}</dd></div>
    </dl>

    <p class="mt-3 text-center text-[11px]">{{ ticket.legal_notice }}</p>
  </article>
</template>
