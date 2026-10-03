<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '@/core/auth/session-store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { formatMoney } from '@/shared/utils/format'
import { salesDocumentsApi } from '../api'
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
const printing = ref(false)
const printError = ref<string | null>(null)

const number = computed(() => (props.sale?.kind === 'ticket' ? props.sale.ticket.display_number : props.sale?.document.display_number))
const total = computed(() => (props.sale?.kind === 'ticket' ? props.sale.ticket.total : props.sale?.document.total))
const label = computed(() => {
  if (props.sale?.kind !== 'document') return 'Ticket'
  return props.sale.document.document_type === '01' ? 'Factura' : 'Boleta'
})
const result = computed(() => (props.sale?.kind === 'document' ? documentResult(props.sale.document) : null))

async function print() {
  if (!props.sale) return
  printError.value = null
  if (props.sale.kind === 'document') {
    try {
      await salesDocumentsApi.download(props.sale.document, '80mm')
    } catch {
      printError.value = 'No se pudo abrir el PDF. Inténtalo desde «Ver detalle».'
    }
    return
  }
  // El ticket se imprime con el mismo formato de 80 mm del detalle y solo existe mientras se
  // imprime. En algunos navegadores móviles print() no bloquea: se retira tras «afterprint».
  printing.value = true
  await nextTick()
  window.addEventListener('afterprint', () => (printing.value = false), { once: true })
  window.print()
}

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
    <BaseAlert v-if="printError" variant="error" class="mt-4">{{ printError }}</BaseAlert>

    <TicketReceipt
      v-if="printing && sale?.kind === 'ticket'"
      :ticket="sale.ticket"
      :company-name="session.session?.company?.nombre_comercial ?? session.session?.company?.razon_social ?? ''"
      :company-ruc="session.session?.company?.ruc ?? ''"
      class="hidden print:block"
    />

    <template #actions>
      <BaseButton variant="ghost" @click="viewDetail">Ver detalle</BaseButton>
      <BaseButton variant="secondary" @click="print">Imprimir</BaseButton>
      <BaseButton data-autofocus class="sm:min-w-36" @click="open = false">Nueva venta</BaseButton>
    </template>
  </BaseDialog>
</template>
