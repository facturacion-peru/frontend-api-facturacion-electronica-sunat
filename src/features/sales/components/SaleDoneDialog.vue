<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'
import PrintFailedAlert from '@/features/printing/components/PrintFailedAlert.vue'
import { usePrinting } from '@/features/printing/composables/usePrinting'
import { usePrinterSettingsStore } from '@/features/printing/stores/printer-settings'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { formatMoney } from '@/shared/utils/format'
import { salesApi, salesDocumentsApi } from '../api'
import { documentResult } from '../document-result'
import type { SalesDocument, Ticket } from '../types'
import TicketReceipt from './TicketReceipt.vue'

/**
 * Confirmación tras cobrar o emitir, sin salir de «Vender» (spec 012 v1.4,
 * HU-5): número, total y, para comprobantes, el resultado de SUNAT.
 * «Nueva venta» es la acción principal; cerrar de cualquier forma equivale.
 */
export type SaleDone = { kind: 'ticket'; ticket: Ticket } | { kind: 'document'; document: SalesDocument }

const props = defineProps<{ sale: SaleDone | null }>()
const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const session = useSessionStore()
const printer = usePrinting()
const printerSettings = usePrinterSettingsStore()
/** El ticket de 80 mm del navegador solo existe mientras se imprime (web). */
const printing = ref(false)

const number = computed(() => (props.sale?.kind === 'ticket' ? props.sale.ticket.display_number : props.sale?.document.display_number))
const total = computed(() => (props.sale?.kind === 'ticket' ? props.sale.ticket.total : props.sale?.document.total))
const label = computed(() => {
  if (props.sale?.kind !== 'document') return 'Ticket'
  return props.sale.document.document_type === '01' ? 'Factura' : 'Boleta'
})
const result = computed(() => (props.sale?.kind === 'document' ? documentResult(props.sale.document) : null))

/**
 * Directo a la impresora Bluetooth si hay una elegida (spec 015). Si no, como
 * antes: el navegador imprime el ticket en la web y el PDF de 80 mm se abre o
 * se comparte (comprobantes y app Android, spec 013).
 */
async function print() {
  const sale = props.sale
  if (!sale) return
  if (sale.kind === 'document') {
    await printer.printDocument(sale.document.id, { pdf: () => salesDocumentsApi.download(sale.document, '80mm') })
  } else {
    await printer.printTicket(sale.ticket.id, { pdf: () => salesApi.ticketPdf(sale.ticket), web: printInBrowser })
  }
}

async function printInBrowser() {
  // En algunos navegadores móviles print() no bloquea: el ticket se retira tras «afterprint».
  printing.value = true
  await nextTick()
  window.addEventListener('afterprint', () => (printing.value = false), { once: true })
  window.print()
}

// «Imprimir al cobrar» (RF-007): opcional, por teléfono y solo con impresora Bluetooth. Una vez por venta.
let autoPrinted: SaleDone | null = null
watch(
  () => [open.value, props.sale] as const,
  ([isOpen, sale]) => {
    if (!isOpen || !sale || sale === autoPrinted || !printerSettings.autoPrint || !printer.direct.value) return
    autoPrinted = sale
    void print()
  },
  { immediate: true },
)

async function viewDetail() {
  if (!props.sale) return
  open.value = false
  await router.push(
    props.sale.kind === 'ticket'
      ? { name: 'ticket-detail', params: { id: props.sale.ticket.id } }
      : { name: 'sales-document-detail', params: { id: props.sale.document.id } },
  )
}
</script>

<template>
  <BaseDialog v-model:open="open" title="Venta registrada">
    <div v-if="sale" class="flex items-center gap-4">
      <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="size-6">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <div class="min-w-0">
        <p class="text-sm text-ink-muted">{{ label }} {{ number }}</p>
        <p class="text-3xl font-semibold tracking-tight text-ink" data-test="done-total">{{ formatMoney(total) }}</p>
      </div>
    </div>

    <BaseAlert v-if="result" :variant="result.variant" class="mt-4">{{ result.text }}</BaseAlert>
    <BaseAlert v-if="printer.error.value" variant="error" class="mt-4">{{ printer.error.value }} Inténtalo desde «Ver detalle».</BaseAlert>
    <PrintFailedAlert
      v-if="printer.failure.value"
      :failure="printer.failure.value"
      :busy="printer.busy.value"
      class="mt-4"
      @retry="printer.retry"
      @share="printer.sharePdf"
    />

    <TicketReceipt
      v-if="printing && sale?.kind === 'ticket'"
      :ticket="sale.ticket"
      :company-name="session.session?.company?.nombre_comercial ?? session.session?.company?.razon_social ?? ''"
      :company-ruc="session.session?.company?.ruc ?? ''"
      class="hidden print:block"
    />

    <template #actions>
      <BaseButton variant="ghost" @click="viewDetail">Ver detalle</BaseButton>
      <BaseButton variant="secondary" :loading="printer.busy.value" @click="print">{{ printer.busy.value ? 'Imprimiendo…' : 'Imprimir' }}</BaseButton>
      <BaseButton data-autofocus class="sm:min-w-36" @click="open = false">Nueva venta</BaseButton>
    </template>
  </BaseDialog>
</template>
