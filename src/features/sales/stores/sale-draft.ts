import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useSessionStore } from '@/core/auth/session-store'
import type { SellableProduct } from '../api'
import { lineAmount, sumAmounts } from '../pricing'
import type { Customer, PaymentMethod, SaleKind } from '../types'

/**
 * Venta en curso de «Vender» (spec 012, A-58). Se guarda en el dispositivo
 * por empresa y usuario: sobrevive a cambiar de pantalla, recargar o cerrar
 * la app. Se borra al cobrar, al vaciar y al cerrar sesión (no al vencer la
 * sesión: RF-003). La clave de idempotencia viaja con la venta, así un cobro
 * reintentado tras volver a la pantalla no la duplica (spec 003, RF-008).
 */
export interface DraftLine {
  product: SellableProduct
  quantity: string
  discount: string
  error: string | null
}

const VERSION = 1

interface Stored {
  v: number
  lines: Omit<DraftLine, 'error'>[]
  kind: SaleKind
  seriesId: number | null
  paymentMethod: PaymentMethod
  customerName: string
  customerDocument: string
  documentCustomer: Customer | null
  idempotencyKey: string
}

export const useSaleDraftStore = defineStore('sale-draft', () => {
  const session = useSessionStore()

  const lines = ref<DraftLine[]>([])
  const kind = ref<SaleKind>('ticket')
  const seriesId = ref<number | null>(null)
  const paymentMethod = ref<PaymentMethod>('cash')
  const customerName = ref('')
  const customerDocument = ref('')
  const documentCustomer = ref<Customer | null>(null)
  const idempotencyKey = ref<string>(crypto.randomUUID())

  const storageKey = computed(() => {
    const companyId = session.session?.company?.id
    const userId = session.session?.user.id

    return companyId && userId ? `sunat.sale-draft.${companyId}.${userId}` : null
  })

  /** Clave cargada: evita releer (y pisar) la venta al volver a la pantalla. */
  let loadedKey: string | null = null

  const count = computed(() => lines.value.length)
  const total = computed(() => sumAmounts(lines.value.map((l) => lineAmount(l.quantity || '0', l.product.sale_price, l.discount))))

  function reset() {
    lines.value = []
    kind.value = 'ticket'
    seriesId.value = null
    paymentMethod.value = 'cash'
    customerName.value = ''
    customerDocument.value = ''
    documentCustomer.value = null
    idempotencyKey.value = crypto.randomUUID()
  }

  /** Lee la venta guardada del usuario y empresa actuales. */
  function load() {
    const key = storageKey.value
    if (!key || key === loadedKey) return
    loadedKey = key
    reset()

    let stored: Stored | null = null
    try {
      stored = JSON.parse(localStorage.getItem(key) ?? 'null') as Stored | null
    } catch {
      // Datos dañados o almacenamiento no disponible: se empieza vacía.
    }
    if (!stored || stored.v !== VERSION || !Array.isArray(stored.lines)) return

    lines.value = stored.lines.map((l) => ({ ...l, error: null }))
    kind.value = stored.kind
    seriesId.value = stored.seriesId
    paymentMethod.value = stored.paymentMethod
    customerName.value = stored.customerName
    customerDocument.value = stored.customerDocument
    documentCustomer.value = stored.documentCustomer
    idempotencyKey.value = stored.idempotencyKey
  }

  function save() {
    if (!storageKey.value || storageKey.value !== loadedKey) return
    const data: Stored = {
      v: VERSION,
      lines: lines.value.map(({ product, quantity, discount }) => ({ product, quantity, discount })),
      kind: kind.value,
      seriesId: seriesId.value,
      paymentMethod: paymentMethod.value,
      customerName: customerName.value,
      customerDocument: customerDocument.value,
      documentCustomer: documentCustomer.value,
      idempotencyKey: idempotencyKey.value,
    }
    try {
      if (lines.value.length === 0) localStorage.removeItem(storageKey.value)
      else localStorage.setItem(storageKey.value, JSON.stringify(data))
    } catch {
      // Sin almacenamiento la venta dura mientras la app esté abierta.
    }
  }

  watch([lines, kind, seriesId, paymentMethod, customerName, customerDocument, documentCustomer, idempotencyKey], save, {
    deep: true,
  })

  function add(product: SellableProduct) {
    const existing = lines.value.find((l) => l.product.id === product.id)
    if (existing) {
      existing.quantity = String(Number(existing.quantity || '0') + 1)
      existing.error = null
    } else {
      lines.value.push({ product, quantity: '1', discount: '', error: null })
    }
  }

  function step(line: DraftLine, delta: number) {
    const next = Number(line.quantity || '0') + delta
    if (next <= 0) remove(line)
    else line.quantity = String(next)
    line.error = null
  }

  function remove(line: DraftLine) {
    lines.value = lines.value.filter((l) => l !== line)
  }

  /** Vacía la venta en curso y la borra del dispositivo. */
  function clear() {
    reset()
    try {
      if (storageKey.value) localStorage.removeItem(storageKey.value)
    } catch {
      // Nada que borrar.
    }
  }

  /**
   * Actualiza precio y disponible con el catálogo (RF-002). Quita lo que ya
   * no existe o está desactivado y devuelve sus nombres para avisar.
   */
  async function refresh(fetch: (id: number) => Promise<SellableProduct & { active: boolean }>): Promise<string[]> {
    const results = await Promise.allSettled(lines.value.map((l) => fetch(l.product.id)))
    const removed: string[] = []

    lines.value = lines.value.filter((line, i) => {
      const result = results[i]!
      if (result.status === 'fulfilled' && result.value.active) {
        const { active: _active, ...product } = result.value
        line.product = { ...line.product, ...product }
        return true
      }
      removed.push(line.product.name)
      return false
    })

    return removed
  }

  return {
    lines,
    kind,
    seriesId,
    paymentMethod,
    customerName,
    customerDocument,
    documentCustomer,
    idempotencyKey,
    count,
    total,
    load,
    add,
    step,
    remove,
    clear,
    refresh,
  }
})
