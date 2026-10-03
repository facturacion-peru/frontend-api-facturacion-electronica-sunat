<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { ApiError } from '@/core/api/errors'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatMoney, formatQuantity } from '@/shared/utils/format'
import { salesDocumentsApi } from '../api'
import type { NewCreditNotePayload, SalesDocument } from '../types'

/**
 * Nota de crédito (spec 007): devolución por ítem o total, o anulación con
 * la opción de reponer el stock (A-40). Los importes los calcula la API.
 */
const props = defineProps<{ document: SalesDocument; mode: 'return' | 'void' }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [SalesDocument] }>()

const reason = ref('')
const restock = ref(true)
const returnAll = ref(false)
const quantities = ref<Record<number, string>>({})
const submitting = ref(false)
const error = ref<string | null>(null)
const lineErrors = ref<Record<number, string>>({})
let idempotencyKey = crypto.randomUUID()

const returnable = computed(() => (props.document.lines ?? []).filter((l) => Number(l.remaining ?? 0) > 0))
const title = computed(() => (props.mode === 'void' ? `Anular ${props.document.display_number}` : `Devolución de ${props.document.display_number}`))

watch(open, (isOpen) => {
  if (!isOpen) return
  reason.value = ''
  restock.value = true
  returnAll.value = false
  quantities.value = {}
  error.value = null
  lineErrors.value = {}
  idempotencyKey = crypto.randomUUID()
})

async function submit() {
  error.value = null
  lineErrors.value = {}
  const selected = returnable.value
    .filter((l) => Number(quantities.value[l.position] || 0) > 0)
    .map((l) => ({ line_position: l.position, quantity: quantities.value[l.position]! }))

  const body: NewCreditNotePayload =
    props.mode === 'void'
      ? { idempotency_key: idempotencyKey, reason_code: '01', reason: reason.value, restock: restock.value }
      : returnAll.value
        ? { idempotency_key: idempotencyKey, reason_code: '06', reason: reason.value }
        : { idempotency_key: idempotencyKey, reason_code: '07', reason: reason.value, lines: selected }

  if (props.mode === 'return' && !returnAll.value && selected.length === 0) {
    error.value = 'Indica la cantidad que se devuelve de al menos un producto.'
    return
  }

  submitting.value = true
  try {
    const note = await salesDocumentsApi.creditNote(props.document.id, body)
    open.value = false
    emit('created', note)
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    // Un 422 no creó nada: la nota corregida es otra operación con otra clave.
    if (e.status === 422) idempotencyKey = crypto.randomUUID()
    for (const [field, messages] of Object.entries(e.fieldErrors)) {
      const match = field.match(/^lines\.(\d+)\./)
      const item = match ? selected[Number(match[1])] : undefined
      if (item) lineErrors.value[item.line_position] = messages[0] ?? ''
    }
    if (Object.keys(lineErrors.value).length === 0) error.value = e.fieldErrors.reason?.[0] ?? Object.values(e.fieldErrors)[0]?.[0] ?? e.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseDialog v-model:open="open" :title="title">
    <form id="credit-note-form" class="space-y-4" novalidate @submit.prevent="submit">
      <BaseAlert v-if="error" variant="error">{{ error }}</BaseAlert>

      <template v-if="mode === 'void'">
        <p class="text-sm">Se emite una nota de crédito por lo que queda del comprobante ({{ formatMoney(document.total) }} si no hubo devoluciones).</p>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input id="credit-restock" v-model="restock" type="checkbox" class="size-4" />
          La mercadería volvió a la tienda (reponer el stock)
        </label>
      </template>

      <template v-else>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input id="credit-return-all" v-model="returnAll" type="checkbox" class="size-4" />
          Devolver todo lo que queda
        </label>
        <ul v-if="!returnAll" class="divide-y divide-line rounded-lg border border-line" data-test="return-lines">
          <li v-for="line in returnable" :key="line.position" class="p-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <label :for="`return-${line.position}`" class="min-w-0">
                <span class="block truncate font-medium">{{ line.product_name }}</span>
                <span class="text-xs text-ink-muted">Quedan {{ formatQuantity(line.remaining) }} · {{ formatMoney(line.unit_price) }} c/u</span>
              </label>
              <BaseInput
                :id="`return-${line.position}`"
                v-model="quantities[line.position]"
                narrow
                inputmode="decimal"
                placeholder="0"
                class="shrink-0 text-right"
              />
            </div>
            <p v-if="lineErrors[line.position]" class="mt-1 text-xs text-danger-700" role="alert">{{ lineErrors[line.position] }}</p>
          </li>
        </ul>
        <p class="text-xs text-ink-muted">El stock de lo devuelto vuelve a la tienda. Los importes los calcula el sistema.</p>
      </template>

      <FormField v-slot="{ describedBy, invalid }" label="Motivo" for="credit-reason" hint="Por ejemplo: producto dañado, el cliente se arrepintió.">
        <BaseInput id="credit-reason" v-model="reason" :invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
    </form>
    <template #actions>
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="credit-note-form" :variant="mode === 'void' ? 'danger' : 'primary'" :loading="submitting">
        {{ mode === 'void' ? 'Anular con nota de crédito' : 'Registrar devolución' }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
