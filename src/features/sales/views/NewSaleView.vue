<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/core/api/errors'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseInput from '@/shared/ui/BaseInput.vue'
import FormField from '@/shared/ui/FormField.vue'
import { formatMoney, formatQuantity } from '@/shared/utils/format'
import { salesApi, type SellableProduct } from '../api'
import { lineAmount, sumAmounts } from '../pricing'
import { paymentLabels, type PaymentMethod } from '../types'

/**
 * Venta rápida (HU-1, CE-001): buscar, tocar para agregar, cobrar. Los
 * importes son una vista previa; el ticket guarda los del servidor.
 */
interface CartLine {
  product: SellableProduct
  quantity: string
  discount: string
  error: string | null
}

const router = useRouter()

const search = ref('')
const results = ref<SellableProduct[]>([])
const cart = ref<CartLine[]>([])
const paymentMethod = ref<PaymentMethod>('cash')
const showCustomer = ref(false)
const customerName = ref('')
const customerDocument = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

// Se conserva entre reintentos de la misma venta para no duplicarla (RF-008).
let idempotencyKey = crypto.randomUUID()

const total = computed(() => sumAmounts(cart.value.map((l) => lineAmount(l.quantity || '0', l.product.sale_price, l.discount))))

const runSearch = useDebounceFn(async () => {
  results.value = search.value.trim() ? await salesApi.searchProducts(search.value.trim()).catch(() => []) : []
}, 250)

function canAdd(product: SellableProduct): boolean {
  return product.type === 'service' || Number(product.available_stock ?? 0) > 0
}

function add(product: SellableProduct) {
  const existing = cart.value.find((l) => l.product.id === product.id)
  if (existing) {
    existing.quantity = String(Number(existing.quantity) + 1)
  } else {
    cart.value.push({ product, quantity: '1', discount: '', error: null })
  }
  search.value = ''
  results.value = []
}

function step(line: CartLine, delta: number) {
  const next = Number(line.quantity || '0') + delta
  if (next <= 0) {
    cart.value = cart.value.filter((l) => l !== line)
  } else {
    line.quantity = String(next)
  }
  line.error = null
}

async function charge() {
  error.value = null
  cart.value.forEach((l) => (l.error = null))
  submitting.value = true

  try {
    const ticket = await salesApi.issue({
      idempotency_key: idempotencyKey,
      payment_method: paymentMethod.value,
      ...(customerName.value && { customer_name: customerName.value }),
      ...(customerDocument.value && { customer_document: customerDocument.value }),
      lines: cart.value.map((l) => ({ product_id: l.product.id, quantity: l.quantity, ...(l.discount && { discount: l.discount }) })),
    })
    idempotencyKey = crypto.randomUUID()
    await router.push({ name: 'ticket-detail', params: { id: ticket.id }, query: { nueva: '1' } })
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    // Un 422 no creó nada: la venta corregida es otra operación con otra clave.
    if (e.status === 422) idempotencyKey = crypto.randomUUID()
    showErrors(e)
  } finally {
    submitting.value = false
  }
}

function showErrors(e: ApiError) {
  const productId = e.meta.product_id as number | undefined
  const stockLine = productId !== undefined ? cart.value.find((l) => l.product.id === productId) : undefined

  if (stockLine) {
    stockLine.error = `Solo hay ${formatQuantity(String(e.meta.available))} disponible.`
    return
  }

  let placed = false
  for (const [field, messages] of Object.entries(e.fieldErrors)) {
    const match = field.match(/^lines\.(\d+)\./)
    const line = match ? cart.value[Number(match[1])] : undefined
    if (line) {
      line.error = messages[0] ?? null
      placed = true
    }
  }

  if (!placed) error.value = Object.values(e.fieldErrors)[0]?.[0] ?? e.message
}
</script>

<template>
  <h1 class="text-xl font-semibold">Vender</h1>

  <div class="mt-4">
    <label for="sale-search" class="sr-only">Buscar producto</label>
    <BaseInput id="sale-search" v-model="search" type="search" placeholder="Buscar producto por nombre o código" autocomplete="off" @input="runSearch" />
    <ul v-if="results.length" class="mt-2 divide-y divide-line rounded-xl border border-line bg-surface" data-test="search-results">
      <li v-for="product in results" :key="product.id">
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-canvas disabled:opacity-50"
          :disabled="!canAdd(product)"
          @click="add(product)"
        >
          <span class="min-w-0">
            <span class="block truncate font-medium">{{ product.name }}</span>
            <span class="text-xs text-ink-muted">
              {{ product.code }}
              <template v-if="product.type === 'good'"> · Disp. {{ formatQuantity(product.available_stock) }}</template>
            </span>
          </span>
          <span class="font-medium">{{ formatMoney(product.sale_price) }}</span>
        </button>
      </li>
    </ul>
  </div>

  <p v-if="cart.length === 0" class="mt-6 text-sm text-ink-muted">Busca un producto y tócalo para agregarlo.</p>

  <ul v-else class="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
    <li v-for="line in cart" :key="line.product.id" class="space-y-2 p-4" data-test="cart-line">
      <div class="flex items-start justify-between gap-3">
        <p class="min-w-0 font-medium">
          <span class="block truncate">{{ line.product.name }}</span>
          <span class="text-xs font-normal text-ink-muted">{{ formatMoney(line.product.sale_price) }} c/u</span>
        </p>
        <p class="font-medium">{{ formatMoney(lineAmount(line.quantity || '0', line.product.sale_price, line.discount)) }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="size-11 rounded-lg border border-line text-lg" :aria-label="`Quitar uno de ${line.product.name}`" @click="step(line, -1)">−</button>
        <label :for="`qty-${line.product.id}`" class="sr-only">Cantidad de {{ line.product.name }}</label>
        <input
          :id="`qty-${line.product.id}`"
          v-model="line.quantity"
          inputmode="decimal"
          class="min-h-11 w-20 rounded-lg border border-line bg-surface px-2 text-center text-base"
        />
        <button type="button" class="size-11 rounded-lg border border-line text-lg" :aria-label="`Agregar uno de ${line.product.name}`" @click="step(line, 1)">+</button>
        <label :for="`disc-${line.product.id}`" class="ml-auto text-xs text-ink-muted">Desc. S/</label>
        <input
          :id="`disc-${line.product.id}`"
          v-model="line.discount"
          inputmode="decimal"
          placeholder="0.00"
          class="min-h-11 w-20 rounded-lg border border-line bg-surface px-2 text-right text-base"
        />
      </div>
      <p v-if="line.error" class="text-xs text-red-600" role="alert">{{ line.error }}</p>
    </li>
  </ul>

  <template v-if="cart.length">
    <fieldset class="mt-4">
      <legend class="text-sm font-medium">Medio de pago</legend>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label
          v-for="(label, value) in paymentLabels"
          :key="value"
          class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm has-checked:border-brand-600 has-checked:bg-brand-50"
        >
          <input v-model="paymentMethod" type="radio" name="payment-method" :value="value" /> {{ label }}
        </label>
      </div>
    </fieldset>

    <button type="button" class="mt-3 min-h-11 text-sm font-medium text-brand-700" :aria-expanded="showCustomer" aria-controls="sale-customer" @click="showCustomer = !showCustomer">
      {{ showCustomer ? 'Quitar datos del cliente' : 'Agregar cliente (opcional)' }}
    </button>
    <div v-show="showCustomer" id="sale-customer" class="grid gap-3 sm:grid-cols-2">
      <FormField label="Nombre del cliente" for="customer-name">
        <BaseInput id="customer-name" v-model="customerName" autocomplete="off" />
      </FormField>
      <FormField label="Documento (opcional)" for="customer-document">
        <BaseInput id="customer-document" v-model="customerDocument" inputmode="numeric" autocomplete="off" />
      </FormField>
    </div>

    <BaseAlert v-if="error" variant="error" class="mt-4">{{ error }}</BaseAlert>

    <div class="sticky bottom-0 mt-4 flex items-center justify-between gap-3 border-t border-line bg-canvas py-3">
      <p>
        <span class="block text-xs text-ink-muted">Total</span>
        <span class="text-xl font-semibold" data-test="sale-total">{{ formatMoney(total) }}</span>
      </p>
      <BaseButton :loading="submitting" @click="charge">Cobrar</BaseButton>
    </div>
  </template>
</template>
