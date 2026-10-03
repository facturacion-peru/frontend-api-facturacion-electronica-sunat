<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseBadge from '@/shared/ui/BaseBadge.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import EnvironmentBadge from '@/shared/ui/EnvironmentBadge.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatDateTime, formatMoney, formatQuantity } from '@/shared/utils/format'
import { useSessionStore } from '@/core/auth/session-store'
import { salesDocumentsApi } from '../api'
import CreditNoteDialog from '../components/CreditNoteDialog.vue'
import { correctionVariant, customerDocumentLabels, documentStatusVariant, paymentLabels, type SalesDocument } from '../types'

/** Detalle del comprobante: estado de SUNAT, descargas y «Reintentar» (HU-1.3, HU-4.3). */
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const document = ref<SalesDocument | null>(null)
const creditMode = ref<'return' | 'void'>('return')
const creditOpen = ref(false)
const discardOpen = ref(false)
const discardReason = ref('')
const discarding = ref(false)
const isNote = computed(() => document.value?.document_type === '07')
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)
const retrying = ref(false)
const justIssued = ref(route.query.nueva === '1')

const affectationLabels: Record<string, string> = { '10': '', '20': 'Exonerado', '30': 'Inafecto' }

const result = computed(() => {
  const d = document.value
  if (!d) return null

  switch (d.status) {
    case 'accepted':
      return { variant: 'success' as const, text: 'SUNAT aceptó el comprobante.' }
    case 'observed':
      return { variant: 'success' as const, text: 'SUNAT aceptó el comprobante con observaciones.' }
    case 'rejected':
      return { variant: 'error' as const, text: 'SUNAT rechazó el comprobante. Revisa el motivo; no se reintenta.' }
    case 'discarded':
      return { variant: 'info' as const, text: `Descartado: ${d.discard_reason}. Su stock se repuso y su número quedó usado.` }
    default:
      return {
        variant: 'warning' as const,
        text: d.next_attempt_at
          ? `SUNAT no respondió. La venta y el número quedaron guardados; se reenviará automáticamente (próximo intento: ${formatDateTime(d.next_attempt_at)}).`
          : 'SUNAT no respondió y se agotaron los reintentos automáticos. Usa «Reintentar».',
      }
  }
})

async function load() {
  try {
    document.value = await salesDocumentsApi.get(Number(route.params.id))
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'No se pudo cargar el comprobante.'
  }
}

async function retry() {
  if (!document.value) return
  retrying.value = true
  actionError.value = null
  try {
    document.value = await salesDocumentsApi.retry(document.value.id)
    justIssued.value = true
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    actionError.value = Object.values(e.fieldErrors)[0]?.[0] ?? e.message
  } finally {
    retrying.value = false
  }
}

async function download(file: 'a4' | '80mm' | 'xml' | 'cdr') {
  if (!document.value) return
  actionError.value = null
  try {
    await salesDocumentsApi.download(document.value, file)
  } catch (e) {
    actionError.value = e instanceof ApiError ? e.message : 'No se pudo descargar el archivo.'
  }
}

function openCredit(mode: 'return' | 'void') {
  creditMode.value = mode
  creditOpen.value = true
}

/** Tras emitir la nota se abre su detalle, con el resultado de SUNAT. */
async function onCreditNote(note: SalesDocument) {
  await router.push({ name: 'sales-document-detail', params: { id: note.id }, query: { nueva: '1' } })
}

async function discard() {
  if (!document.value) return
  discarding.value = true
  actionError.value = null
  try {
    document.value = await salesDocumentsApi.discard(document.value.id, discardReason.value)
    discardOpen.value = false
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    actionError.value = Object.values(e.fieldErrors)[0]?.[0] ?? e.message
    discardOpen.value = false
  } finally {
    discarding.value = false
  }
}

onMounted(load)
// La misma vista sirve para el comprobante y sus notas: recarga al cambiar de id.
watch(
  () => route.params.id,
  () => {
    justIssued.value = route.query.nueva === '1'
    load()
  },
)
</script>

<template>
  <RouterLink :to="{ name: 'sales-documents' }" class="inline-flex min-h-11 items-center text-sm text-brand-700">← Comprobantes</RouterLink>

  <BaseAlert v-if="loadError" variant="error" class="mt-2">{{ loadError }}</BaseAlert>

  <template v-else-if="document">
    <div class="mt-2 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">{{ document.document_type_label }} {{ document.display_number }}</h1>
      <EnvironmentBadge :environment="document.environment" />
      <BaseBadge :variant="documentStatusVariant[document.status]" data-test="status">{{ document.status_label }}</BaseBadge>
      <BaseBadge v-if="document.correction_status !== 'none'" :variant="correctionVariant[document.correction_status]" data-test="correction">
        {{ document.correction_status_label }}
      </BaseBadge>
    </div>

    <p v-if="isNote && document.reference" class="mt-2 text-sm" data-test="reference">
      Modifica
      <RouterLink :to="{ name: 'sales-document-detail', params: { id: document.reference.id } }" class="font-medium text-brand-700">
        {{ document.reference.display_number }}
      </RouterLink>
      · {{ document.note_reason_label }}: {{ document.note_reason }}
    </p>

    <BaseAlert v-if="result && (justIssued || document.status !== 'accepted')" :variant="result.variant" class="mt-4" data-test="result">
      <p>{{ result.text }}</p>
      <p v-if="document.sunat_message && document.status !== 'pending'" class="mt-1 text-xs">
        <template v-if="document.sunat_code">Código {{ document.sunat_code }}: </template>{{ document.sunat_message }}
      </p>
      <ul v-if="document.sunat_notes.length" class="mt-2 list-disc space-y-1 pl-5 text-xs" data-test="notes">
        <li v-for="note in document.sunat_notes" :key="note">{{ note }}</li>
      </ul>
    </BaseAlert>

    <BaseAlert v-if="actionError" variant="error" class="mt-4">{{ actionError }}</BaseAlert>

    <div class="mt-4 flex flex-wrap gap-2" data-test="actions">
      <BaseButton v-if="document.can_retry" :loading="retrying" @click="retry">Reintentar</BaseButton>
      <BaseButton variant="secondary" @click="download('a4')">PDF A4</BaseButton>
      <BaseButton variant="secondary" @click="download('80mm')">PDF 80 mm</BaseButton>
      <BaseButton variant="secondary" @click="download('xml')">XML</BaseButton>
      <BaseButton v-if="document.has_cdr" variant="secondary" @click="download('cdr')">CDR</BaseButton>
    </div>

    <div v-if="document.can_credit" class="mt-2 flex flex-wrap gap-2" data-test="credit-actions">
      <BaseButton variant="secondary" @click="openCredit('return')">Registrar devolución</BaseButton>
      <BaseButton variant="danger" @click="openCredit('void')">Anular</BaseButton>
    </div>
    <div v-if="document.status === 'rejected' && session.isCompanyAdmin" class="mt-2">
      <BaseButton variant="secondary" @click="discardOpen = true">Descartar</BaseButton>
    </div>

    <section class="mt-4 grid gap-3 rounded-xl border border-line bg-surface p-4 text-sm sm:grid-cols-2" aria-label="Datos del comprobante">
      <div>
        <p class="text-ink-muted">Cliente</p>
        <p class="font-medium" data-test="customer">{{ document.customer.name }}</p>
        <p v-if="document.customer.document_number !== '-'" class="text-ink-muted">
          {{ customerDocumentLabels[document.customer.document_type] }} {{ document.customer.document_number }}
        </p>
      </div>
      <div>
        <p class="text-ink-muted">Emitido</p>
        <p>{{ formatDateTime(document.issued_at) }} · {{ document.seller?.name }}</p>
        <p class="text-ink-muted">{{ paymentLabels[document.payment_method] }} · al contado</p>
      </div>
    </section>

    <ul class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface" aria-label="Productos">
      <li v-for="line in document.lines" :key="line.position" class="flex items-start justify-between gap-3 p-4 text-sm" data-test="line">
        <p class="min-w-0">
          <span class="block font-medium">{{ line.product_name }}</span>
          <span class="text-ink-muted">
            {{ formatQuantity(line.quantity) }} × {{ formatMoney(line.unit_price) }}
            <template v-if="Number(line.discount) > 0"> · desc. {{ formatMoney(line.discount) }}</template>
            <template v-if="affectationLabels[line.igv_affectation]"> · {{ affectationLabels[line.igv_affectation] }}</template>
          </span>
          <span v-if="line.remaining !== null && Number(line.remaining) < Number(line.quantity)" class="block text-xs text-warning-800">
            Quedan {{ formatQuantity(line.remaining) }} por devolver
          </span>
        </p>
        <p class="font-medium">{{ formatMoney(line.amount) }}</p>
      </li>
    </ul>

    <dl class="mt-4 space-y-1 rounded-xl border border-line bg-surface p-4 text-sm" data-test="totals">
      <div v-if="Number(document.op_gravadas) > 0" class="flex justify-between"><dt>Op. gravadas</dt><dd>{{ formatMoney(document.op_gravadas) }}</dd></div>
      <div v-if="Number(document.op_exoneradas) > 0" class="flex justify-between"><dt>Op. exoneradas</dt><dd>{{ formatMoney(document.op_exoneradas) }}</dd></div>
      <div v-if="Number(document.op_inafectas) > 0" class="flex justify-between"><dt>Op. inafectas</dt><dd>{{ formatMoney(document.op_inafectas) }}</dd></div>
      <div class="flex justify-between"><dt>IGV (18 %)</dt><dd>{{ formatMoney(document.igv) }}</dd></div>
      <div class="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{{ formatMoney(document.total) }}</dd></div>
    </dl>

    <section v-if="document.credit_notes?.length" class="mt-4 rounded-xl border border-line bg-surface p-4 text-sm" aria-labelledby="notes-title">
      <h2 id="notes-title" class="font-medium">Notas de crédito</h2>
      <ul class="mt-2 divide-y divide-line" data-test="credit-notes">
        <li v-for="note in document.credit_notes" :key="note.id" class="flex items-center justify-between gap-3 py-2">
          <RouterLink :to="{ name: 'sales-document-detail', params: { id: note.id } }" class="min-w-0 text-brand-700">
            <span class="font-medium">{{ note.display_number }}</span> · {{ note.note_reason_label }}
          </RouterLink>
          <span class="flex items-center gap-2">
            <BaseBadge :variant="documentStatusVariant[note.status]">{{ note.status_label }}</BaseBadge>
            <span>{{ formatMoney(note.total) }}</span>
          </span>
        </li>
      </ul>
    </section>

    <details v-if="document.submissions?.length" class="mt-4 rounded-xl border border-line bg-surface p-4 text-sm">
      <summary class="min-h-11 cursor-pointer font-medium">Envíos a SUNAT ({{ document.submissions.length }})</summary>
      <ul class="mt-2 space-y-1 text-ink-muted" data-test="submissions">
        <li v-for="(s, i) in document.submissions" :key="i">
          {{ formatDateTime(s.started_at) }} · {{ s.result }}<template v-if="s.code"> ({{ s.code }})</template><template v-if="s.message"> · {{ s.message }}</template>
        </li>
      </ul>
    </details>
    <CreditNoteDialog v-model:open="creditOpen" :document="document" :mode="creditMode" @created="onCreditNote" />

    <BaseDialog v-model:open="discardOpen" title="Descartar comprobante rechazado">
      <form id="discard-form" class="space-y-4" novalidate @submit.prevent="discard">
        <p class="text-sm">Queda como descartado, su stock se repone y su número no se reutiliza. Luego emite un comprobante nuevo con los datos corregidos.</p>
        <FormField label="Motivo" for="discard-reason">
          <BaseInput id="discard-reason" v-model="discardReason" />
        </FormField>
      </form>
      <template #actions>
        <BaseButton variant="secondary" @click="discardOpen = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="discard-form" :loading="discarding">Descartar</BaseButton>
      </template>
    </BaseDialog>
  </template>
</template>
