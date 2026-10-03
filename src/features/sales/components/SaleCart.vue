<script setup lang="ts">
import { ref } from 'vue'

import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import BaseSelect from '@/shared/ui/BaseSelect.vue'
import EnvironmentBadge from '@/shared/ui/EnvironmentBadge.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatMoney } from '@/shared/utils/format'
import { lineAmount } from '../pricing'
import { useSaleDraftStore } from '../stores/sale-draft'
import { paymentLabels, type IssuingAvailability, type SaleKind } from '../types'
import CustomerPicker from './CustomerPicker.vue'

/**
 * Carrito de «Vender» (spec 012): líneas, cliente, serie, medio de pago,
 * total y cobro. Trabaja sobre la venta en curso (store `sale-draft`); la
 * vista decide dónde se muestra (columna fija o hoja en el celular). Ese
 * contenedor se desplaza y tiene `p-5`: el pie con el total se pega a su
 * borde inferior para que «Cobrar» siempre esté a la vista.
 *
 * Orden del cobro (v1.3): productos, qué emitir (decide serie, cliente y
 * botón, por eso va junto a ellos), cliente, medio de pago y el total.
 */
defineProps<{
  kinds: { value: SaleKind; label: string; disabled: boolean }[]
  /** Por qué boleta y factura no están disponibles, o null. */
  blockedMessage: string | null
  kindSeries: IssuingAvailability['series']
  needsReceiptCustomer: boolean
  needsInvoiceCustomer: boolean
  chargeLabel: string
  submitting: boolean
  error: string | null
}>()

const emit = defineEmits<{ charge: []; clear: []; 'kind-changed': [] }>()

const draft = useSaleDraftStore()
const showCustomer = ref(Boolean(draft.customerName || draft.customerDocument))
</script>

<template>
  <section aria-labelledby="cart-title" class="flex flex-col">
    <div class="flex items-center justify-between gap-3">
      <h2 id="cart-title" class="font-semibold text-ink">
        Carrito <span v-if="draft.count" class="font-normal text-ink-muted">({{ draft.count }})</span>
      </h2>
      <button
        v-if="draft.count"
        type="button"
        data-test="clear-cart"
        class="min-h-11 rounded-lg px-2 text-sm font-medium text-danger-700 hover:bg-danger-50"
        @click="emit('clear')"
      >
        Vaciar carrito
      </button>
    </div>

    <p v-if="draft.count === 0" class="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
      Toca un producto para agregarlo.
    </p>

    <template v-else>
      <ul class="mt-2 divide-y divide-line">
        <li v-for="line in draft.lines" :key="line.product.id" class="space-y-2 py-3" data-test="cart-line">
          <div class="flex items-start justify-between gap-3">
            <p class="min-w-0 text-sm font-medium">
              <span class="block truncate">{{ line.product.name }}</span>
              <span class="text-xs font-normal text-ink-muted">{{ formatMoney(line.product.sale_price) }} c/u</span>
            </p>
            <p class="text-sm font-semibold">{{ formatMoney(lineAmount(line.quantity || '0', line.product.sale_price, line.discount)) }}</p>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="size-11 shrink-0 rounded-lg border border-line text-lg hover:bg-subtle"
              :aria-label="`Quitar uno de ${line.product.name}`"
              @click="draft.step(line, -1)"
            >
              −
            </button>
            <label :for="`qty-${line.product.id}`" class="sr-only">Cantidad de {{ line.product.name }}</label>
            <BaseInput :id="`qty-${line.product.id}`" v-model="line.quantity" narrow inputmode="decimal" class="text-center" />
            <button
              type="button"
              class="size-11 shrink-0 rounded-lg border border-line text-lg hover:bg-subtle"
              :aria-label="`Agregar uno de ${line.product.name}`"
              @click="draft.step(line, 1)"
            >
              +
            </button>
            <label :for="`disc-${line.product.id}`" class="ml-auto text-xs whitespace-nowrap text-ink-muted">Desc. S/</label>
            <BaseInput :id="`disc-${line.product.id}`" v-model="line.discount" narrow inputmode="decimal" placeholder="0.00" class="text-right" />
          </div>
          <p v-if="line.error" class="text-xs text-danger-700" role="alert">{{ line.error }}</p>
        </li>
      </ul>

      <!-- Orden del cobro (v1.3): qué llevo, qué emito y a quién, cómo me pagan, cobrar. -->
      <fieldset class="mt-3 border-t border-line pt-3">
        <legend class="text-sm font-medium">Comprobante</legend>
        <div class="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-subtle p-1" data-test="sale-kind">
          <label
            v-for="k in kinds"
            :key="k.value"
            class="flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium text-ink-muted transition hover:text-ink has-checked:bg-surface has-checked:text-brand-700 has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-brand-600 has-disabled:cursor-not-allowed has-disabled:opacity-50"
          >
            <input
              v-model="draft.kind"
              type="radio"
              name="sale-kind"
              class="sr-only"
              :value="k.value"
              :disabled="k.disabled"
              @change="emit('kind-changed')"
            />
            {{ k.label }}
          </label>
        </div>
        <p v-if="blockedMessage" class="mt-1.5 text-xs text-ink-muted" data-test="kind-blocked">Boleta y factura: {{ blockedMessage }}</p>
        <EnvironmentBadge v-if="draft.kind !== 'ticket'" class="mt-2" />
      </fieldset>

      <div v-if="draft.kind !== 'ticket'" class="mt-3 space-y-3">
        <FormField v-if="kindSeries.length > 1" label="Serie" for="sale-series">
          <BaseSelect id="sale-series" v-model="draft.seriesId">
            <option v-for="s in kindSeries" :key="s.id" :value="s.id">{{ s.code }}</option>
          </BaseSelect>
        </FormField>
        <div>
          <p class="text-sm font-medium">{{ draft.kind === '01' ? 'Cliente (con RUC)' : 'Cliente (opcional hasta S/ 700)' }}</p>
          <CustomerPicker v-model="draft.documentCustomer" class="mt-1" :require-ruc="draft.kind === '01'" />
        </div>
        <BaseAlert v-if="needsReceiptCustomer" variant="warning" data-test="receipt-limit">
          Las boletas de más de S/ 700 requieren el documento del comprador.
        </BaseAlert>
      </div>

      <template v-else>
        <button
          type="button"
          class="mt-2 min-h-11 self-start text-sm font-medium text-brand-700"
          :aria-expanded="showCustomer"
          aria-controls="sale-customer"
          @click="showCustomer = !showCustomer"
        >
          {{ showCustomer ? 'Ocultar datos del cliente' : 'Agregar cliente (opcional)' }}
        </button>
        <div v-show="showCustomer" id="sale-customer" class="grid gap-3">
          <FormField label="Nombre del cliente" for="customer-name">
            <BaseInput id="customer-name" v-model="draft.customerName" autocomplete="off" />
          </FormField>
          <FormField label="Documento (opcional)" for="customer-document">
            <BaseInput id="customer-document" v-model="draft.customerDocument" inputmode="numeric" autocomplete="off" />
          </FormField>
        </div>
      </template>

      <fieldset class="mt-4 border-t border-line pt-3">
        <legend class="text-sm font-medium">Medio de pago</legend>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <label
            v-for="(label, value) in paymentLabels"
            :key="value"
            class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"
          >
            <input v-model="draft.paymentMethod" type="radio" name="payment-method" :value="value" /> {{ label }}
          </label>
        </div>
      </fieldset>

      <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

      <!-- Total y cobro siempre a la vista: fijos al pie del contenedor que se desplaza (columna o hoja). -->
      <div class="sticky -bottom-5 -mx-5 mt-4 border-t border-line bg-surface px-5 pt-4 pb-5">
        <p class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-ink-muted">Total</span>
          <span class="text-2xl font-semibold tracking-tight" data-test="sale-total">{{ formatMoney(draft.total) }}</span>
        </p>
        <BaseButton
          block
          class="mt-3 min-h-12 text-base"
          :loading="submitting"
          :disabled="needsReceiptCustomer || needsInvoiceCustomer"
          @click="emit('charge')"
        >
          {{ chargeLabel }}
        </BaseButton>
      </div>
    </template>
  </section>
</template>
