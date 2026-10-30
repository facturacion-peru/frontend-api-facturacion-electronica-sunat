<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import { ApiError } from '@/core/api/errors'
import EstablishmentSwitcher from '@/shared/establishments/EstablishmentSwitcher.vue'
import { useEstablishmentStore } from '@/shared/establishments/store'
import BaseAlert from '@/shared/ui/BaseAlert.vue'
import BaseButton from '@/shared/ui/BaseButton.vue'
import BaseDialog from '@/shared/ui/BaseDialog.vue'
import { formatMoney, formatQuantity } from '@/shared/utils/format'
import { salesApi, salesDocumentsApi, type SellableProduct } from '../api'
import ProductCatalog from '../components/ProductCatalog.vue'
import SaleDoneDialog, { type SaleDone } from '../components/SaleDoneDialog.vue'
import SaleCart from '../components/SaleCart.vue'
import { useSaleDraftStore } from '../stores/sale-draft'
import { ANONYMOUS_RECEIPT_LIMIT, type IssuingAvailability, type SaleKind } from '../types'

/**
 * Venta rápida (spec 003 HU-1, spec 012): tocar productos del catálogo y
 * cobrar. Desde aquí también se emite boleta o factura (spec 005, A-33).
 * Tras cobrar, la venta se confirma en un modal sin salir de la pantalla.
 *
 * La venta en curso vive en el store `sale-draft` y se conserva al salir y
 * volver (A-58). En pantallas anchas, catálogo y carrito en dos columnas; en
 * el celular, una barra fija abre el carrito como hoja (A-56). Los importes
 * son una vista previa: el servidor guarda los suyos.
 *
 * Todo es del local actual (spec 017): el catálogo, las series, el stock y la
 * venta en curso. Cambiar de local carga la venta guardada en el otro y la
 * cobra allí; sin local elegido no hay catálogo ni carrito.
 */
const establishments = useEstablishmentStore()
const switcher = useTemplateRef<InstanceType<typeof EstablishmentSwitcher>>('switcher')
const draft = useSaleDraftStore()
// Antes de pintar: el carrito y sus hijos ya ven la venta restaurada.
draft.load()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const submitting = ref(false)
const error = ref<string | null>(null)
const removedNotice = ref<string | null>(null)
const cartOpen = ref(false)
const confirmClear = ref(false)
/** Venta recién registrada: se confirma en un modal sin salir de «Vender» (v1.4). */
const done = ref<SaleDone | null>(null)
const doneOpen = ref(false)

// Cerrar la confirmación de cualquier forma deja lista la siguiente venta.
watch(doneOpen, async (isOpen) => {
  if (isOpen) return
  await nextTick()
  document.getElementById('sale-search')?.focus()
})

const catalog = useTemplateRef<InstanceType<typeof ProductCatalog>>('catalog')

function finish(sale: SaleDone) {
  // La siguiente venta empieza con el mismo comprobante y serie (v1.5, A-60).
  draft.remember()
  draft.clear()
  catalog.value?.reload()
  cartOpen.value = false
  done.value = sale
  doneOpen.value = true
}

const availability = ref<IssuingAvailability | null>(null)
const availabilityError = ref(false)

const kinds: { value: SaleKind; label: string }[] = [
  { value: 'ticket', label: 'Ticket' },
  { value: '03', label: 'Boleta' },
  { value: '01', label: 'Factura' },
]

const kindSeries = computed(() => availability.value?.series.filter((s) => s.document_type === draft.kind) ?? [])

const inCart = computed(() => Object.fromEntries(draft.lines.map((l) => [l.product.id, l.quantity])))

/** Por qué no se puede emitir boleta o factura, o null si se puede. */
function blockedReason(value: SaleKind): string | null {
  if (value === 'ticket') return null
  if (availabilityError.value) return 'No se pudo consultar la emisión SUNAT.'
  if (!availability.value) return 'Consultando la emisión SUNAT…'
  if (!availability.value.can_issue) return `Emisión SUNAT: ${availability.value.status_label}.`
  if (!availability.value.series.some((s) => s.document_type === value)) return 'No hay una serie activa. Pide al administrador que la cree.'

  return null
}

/** Boleta de más de S/ 700 sin comprador identificado (A-22 ⚖️); la API lo hace cumplir. */
const needsReceiptCustomer = computed(
  () => draft.kind === '03' && !draft.documentCustomer && Number(draft.total) > Number(ANONYMOUS_RECEIPT_LIMIT),
)
const needsInvoiceCustomer = computed(() => draft.kind === '01' && draft.documentCustomer?.document_type !== '6')
/** Código de la serie elegida (B001…), o null para el ticket o sin serie. */
const seriesCode = computed(() => (draft.kind === 'ticket' ? null : (kindSeries.value.find((s) => s.id === draft.seriesId)?.code ?? null)))
/** Dice qué se emitirá: una boleta recordada va a SUNAT (RF-011). */
const chargeLabel = computed(() => {
  const label = { ticket: 'Cobrar', '03': 'Emitir boleta', '01': 'Emitir factura' }[draft.kind]

  return seriesCode.value ? `${label} · ${seriesCode.value}` : label
})

/** Cambio de tipo hecho por el usuario: otra operación, otra clave y la serie por defecto. */
function onKindChanged() {
  draft.idempotencyKey = crypto.randomUUID()
  draft.seriesId = kindSeries.value[0]?.id ?? null
  if (draft.kind === '01' && draft.documentCustomer?.document_type !== '6') draft.documentCustomer = null
  draft.remember()
  error.value = null
}

function onSeriesChanged(id: number) {
  draft.seriesId = id
  draft.remember()
}

/** La venta restaurada pudo quedar con un tipo o serie que ya no sirven (casos límite de la spec 012). */
function validateRestoredKind() {
  if (blockedReason(draft.kind)) {
    draft.kind = 'ticket'
    return
  }
  if (draft.kind !== 'ticket' && !kindSeries.value.some((s) => s.id === draft.seriesId)) {
    draft.seriesId = kindSeries.value[0]?.id ?? null
  }
}

/**
 * Local para las lecturas (catálogo, series y precios). Con un solo local se
 * omite y las peticiones son las de antes (RF-010); el cobro lo manda siempre.
 */
const readEstablishment = computed(() => (establishments.multi ? draft.establishmentId : null))

/** Local para el que ya se pidieron series y precios: evita repetirlo si cambia dos veces seguidas. */
let preparedFor: number | null = null

/** Precios y disponible de la venta guardada, y las series del local (spec 012 RF-002; spec 017). */
async function prepare(establishmentId: number) {
  if (preparedFor === establishmentId) return
  preparedFor = establishmentId
  removedNotice.value = null
  availability.value = null
  availabilityError.value = false
  const refreshing = draft.lines.length
    ? draft.refresh((id) => salesApi.getProduct(id, readEstablishment.value)).then((removed) => {
        if (removed.length) removedNotice.value = `Se quitó del carrito: ${removed.join(', ')}. Ya no está disponible para la venta.`
      })
    : Promise.resolve()

  try {
    const result = await salesDocumentsApi.availability(readEstablishment.value)
    if (preparedFor !== establishmentId) return
    availability.value = result
  } catch {
    availabilityError.value = true
  }
  validateRestoredKind()
  await refreshing
}

// Otro local: la venta guardada allí ya está cargada (sale-draft); faltan sus series y precios.
watch(
  () => draft.establishmentId,
  (id) => {
    error.value = null
    if (id) prepare(id)
    else preparedFor = null
  },
)

/** Pide elegir si el local recordado ya no vale (HU-2, esc. 5) o aún no hay uno. */
async function refreshEstablishments() {
  await establishments.reload().catch(() => {
    // Sin red: se sigue con los locales de la sesión.
  })
  if (establishments.needsChoice) switcher.value?.open()
}

onMounted(async () => {
  await refreshEstablishments()
  if (draft.establishmentId) await prepare(draft.establishmentId)
})

function add(product: SellableProduct) {
  draft.add(product)
}

function clearCart() {
  draft.clear()
  confirmClear.value = false
  cartOpen.value = false
  error.value = null
}

/** La venta se cobra en el local donde se armó: el de su clave guardada (spec 017). */
function establishmentField() {
  return draft.establishmentId ? { establishment_id: draft.establishmentId } : {}
}

async function charge() {
  error.value = null
  draft.lines.forEach((l) => (l.error = null))
  submitting.value = true
  const lines = draft.lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity, ...(l.discount && { discount: l.discount }) }))

  try {
    if (draft.kind !== 'ticket') {
      const document = await salesDocumentsApi.issue({
        ...establishmentField(),
        idempotency_key: draft.idempotencyKey,
        document_type: draft.kind,
        series_id: draft.seriesId,
        customer_id: draft.documentCustomer?.id ?? null,
        payment_method: draft.paymentMethod,
        lines,
      })
      finish({ kind: 'document', document })
      return
    }

    const ticket = await salesApi.issue({
      ...establishmentField(),
      idempotency_key: draft.idempotencyKey,
      payment_method: draft.paymentMethod,
      ...(draft.customerName && { customer_name: draft.customerName }),
      ...(draft.customerDocument && { customer_document: draft.customerDocument }),
      lines,
    })
    finish({ kind: 'ticket', ticket })
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    // Un 422 no creó nada: la venta corregida es otra operación con otra clave.
    if (e.status === 422) draft.idempotencyKey = crypto.randomUUID()
    showErrors(e)
    // El local se desactivó o le quitaron el local al vendedor: se vuelve a preguntar.
    if (e.fieldErrors.establishment_id) await refreshEstablishments()
    // La serie ya no es de un local donde trabaja: se vuelven a pedir las del local.
    if (e.fieldErrors.series_id && draft.establishmentId) {
      preparedFor = null
      await prepare(draft.establishmentId)
    }
  } finally {
    submitting.value = false
  }
}

function showErrors(e: ApiError) {
  const productId = e.meta.product_id as number | undefined
  const stockLine = productId !== undefined ? draft.lines.find((l) => l.product.id === productId) : undefined

  if (stockLine) {
    stockLine.error = `Solo hay ${formatQuantity(String(e.meta.available))} disponible.`
    return
  }

  let placed = false
  for (const [field, messages] of Object.entries(e.fieldErrors)) {
    const match = field.match(/^lines\.(\d+)\./)
    const line = match ? draft.lines[Number(match[1])] : undefined
    if (line) {
      line.error = messages[0] ?? null
      placed = true
    }
  }

  if (!placed) error.value = Object.values(e.fieldErrors)[0]?.[0] ?? e.message
}

const kindLabel = computed(() => [kinds.find((k) => k.value === draft.kind)?.label, seriesCode.value].filter(Boolean).join(' '))

const cartProps = computed(() => ({
  kinds: kinds.map((k) => ({ ...k, disabled: blockedReason(k.value) !== null })),
  blockedMessage: blockedReason('03'),
  kindSeries: kindSeries.value,
  needsReceiptCustomer: needsReceiptCustomer.value,
  needsInvoiceCustomer: needsInvoiceCustomer.value,
  chargeLabel: chargeLabel.value,
  submitting: submitting.value,
  error: error.value,
}))
</script>

<template>
  <!-- Escritorio: ocupa el alto que da el layout (meta.fullWidth); catálogo y carrito se desplazan por separado. -->
  <div class="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" :class="!isDesktop && draft.count ? 'pb-24' : ''">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">Vender</h1>
      <div class="min-w-0 max-w-full sm:max-w-xs" data-test="sale-establishment">
        <EstablishmentSwitcher ref="switcher" :draft-count="draft.count" />
      </div>
    </div>

    <BaseAlert v-if="establishments.noneAllowed" variant="warning" class="mt-4" data-test="no-establishment">
      No tienes un local asignado. Pide al administrador que te asigne uno.
    </BaseAlert>

    <div v-else-if="!draft.establishmentId" class="mt-4 rounded-2xl border border-line bg-surface p-6 text-center" data-test="choose-establishment">
      <p class="font-medium">¿En qué local vas a vender?</p>
      <p class="mt-1 text-sm text-ink-muted">El catálogo, las series y el stock son de cada local.</p>
      <BaseButton class="mt-4" @click="switcher?.open()">Elegir local</BaseButton>
    </div>

    <template v-else>
      <BaseAlert v-if="removedNotice" variant="warning" class="mt-4">{{ removedNotice }}</BaseAlert>

      <div class="mt-4 grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div class="lg:-mx-2 lg:min-h-0 lg:overflow-y-auto lg:px-2">
          <ProductCatalog ref="catalog" :in-cart="inCart" :establishment-id="readEstablishment" @add="add" />
        </div>

        <aside v-if="isDesktop" class="min-h-0 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <SaleCart v-bind="cartProps" @charge="charge" @clear="confirmClear = true" @kind-changed="onKindChanged" @series-changed="onSeriesChanged" />
        </aside>
      </div>
    </template>

    <!-- Celular: barra fija con cantidad y total; abre el carrito como hoja. -->
    <div
      v-if="!isDesktop && draft.count"
      data-test="cart-bar"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgb(0_0_0/0.06)] backdrop-blur"
    >
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p class="min-w-0">
          <span class="block text-xs text-ink-muted">
            {{ kindLabel }} · {{ draft.count === 1 ? '1 producto' : `${draft.count} productos` }}
          </span>
          <span class="text-lg font-semibold">{{ formatMoney(draft.total) }}</span>
        </p>
        <BaseButton class="min-h-12 px-6 text-base" @click="cartOpen = true">Ver carrito</BaseButton>
      </div>
    </div>

    <BaseDialog v-if="!isDesktop" v-model:open="cartOpen" title="Tu venta">
      <SaleCart v-bind="cartProps" @charge="charge" @clear="confirmClear = true" @kind-changed="onKindChanged" @series-changed="onSeriesChanged" />
    </BaseDialog>

    <SaleDoneDialog v-model:open="doneOpen" :sale="done" />

    <BaseDialog v-model:open="confirmClear" title="¿Vaciar el carrito?">
      <p class="text-sm text-ink-muted">
        Se quitarán {{ draft.count === 1 ? '1 producto' : `${draft.count} productos` }} de la venta en curso.
      </p>
      <template #actions>
        <BaseButton variant="secondary" @click="confirmClear = false">Cancelar</BaseButton>
        <BaseButton variant="danger" @click="clearCart">Vaciar carrito</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
