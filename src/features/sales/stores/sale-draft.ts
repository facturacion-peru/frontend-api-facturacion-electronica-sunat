import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useSessionStore } from '@/core/auth/session-store'
import { useEstablishmentStore } from '@/shared/establishments/store'
import type { SellableProduct } from '../api'
import { lineAmount, sumAmounts } from '../pricing'
import type { Customer, PaymentMethod, SaleKind } from '../types'

/**
 * Venta en curso de «Vender» (spec 012, A-58). Se guarda en el dispositivo
 * por empresa y usuario: sobrevive a cambiar de pantalla, recargar o cerrar
 * la app. Se borra al cobrar, al vaciar y al cerrar sesión (no al vencer la
 * sesión: RF-003). La clave de idempotencia viaja con la venta, así un cobro
 * reintentado tras volver a la pantalla no la duplica (spec 003, RF-008).
 *
 * Aparte, el último comprobante y serie elegidos (v1.5, A-60) se recuerdan en
 * otra clave que no borra `clear()`: cada venta nueva empieza con ellos.
 *
 * Las dos son del local actual (spec 017): cambiar de local guarda la venta
 * de uno y carga la del otro, sin mezclarlas. Sin local elegido no hay venta.
 */
export interface DraftLine {
  product: SellableProduct
  quantity: string
  discount: string
  error: string | null
}

const VERSION = 1

/**
 * Solo los campos de `SellableProduct`: lo que llega del catálogo o de la API
 * trae más (p. ej. la foto, spec 016), y la venta guardada no debe llevarlo.
 */
function sellable({ id, code, name, type, unit, sale_price, available_stock }: SellableProduct): SellableProduct {
  return { id, code, name, type, unit, sale_price, available_stock }
}

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

interface Preference {
  v: number
  kind: SaleKind
  seriesId: number | null
}

const KINDS: readonly SaleKind[] = ['ticket', '03', '01']

/** Lee la preferencia guardada; dañada, de otra versión o sin almacenamiento: ticket. */
function readPreference(key: string): Pick<Preference, 'kind' | 'seriesId'> {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as Preference | null
    if (stored?.v === VERSION && KINDS.includes(stored.kind)) {
      return { kind: stored.kind, seriesId: typeof stored.seriesId === 'number' ? stored.seriesId : null }
    }
  } catch {
    // Se empieza con ticket.
  }

  return { kind: 'ticket', seriesId: null }
}

export const useSaleDraftStore = defineStore('sale-draft', () => {
  const session = useSessionStore()
  const establishments = useEstablishmentStore()

  const lines = ref<DraftLine[]>([])
  const kind = ref<SaleKind>('ticket')
  const seriesId = ref<number | null>(null)
  const paymentMethod = ref<PaymentMethod>('cash')
  const customerName = ref('')
  const customerDocument = ref('')
  const documentCustomer = ref<Customer | null>(null)
  const idempotencyKey = ref<string>(crypto.randomUUID())

  /** `<empresa>.<usuario>`: lo que tenían las claves antes de la 017. */
  const owner = computed(() => {
    const companyId = session.session?.company?.id
    const userId = session.session?.user.id

    return companyId && userId ? `${companyId}.${userId}` : null
  })
  const establishmentId = computed(() => (owner.value ? (establishments.current?.id ?? null) : null))
  const storageKey = computed(() => (establishmentId.value ? `sunat.sale-draft.${owner.value}.${establishmentId.value}` : null))
  const preferenceKey = computed(() => storageKey.value?.replace('sunat.sale-draft.', 'sunat.sale-preference.') ?? null)

  /** Comprobante y serie con que empieza cada venta (RF-009). */
  let preference: Pick<Preference, 'kind' | 'seriesId'> = { kind: 'ticket', seriesId: null }

  /** Clave cargada: evita releer (y pisar) la venta al volver a la pantalla. */
  let loadedKey: string | null = null

  const count = computed(() => lines.value.length)
  const total = computed(() => sumAmounts(lines.value.map((l) => lineAmount(l.quantity || '0', l.product.sale_price, l.discount))))

  function reset() {
    lines.value = []
    kind.value = preference.kind
    seriesId.value = preference.seriesId
    paymentMethod.value = 'cash'
    customerName.value = ''
    customerDocument.value = ''
    documentCustomer.value = null
    idempotencyKey.value = crypto.randomUUID()
  }

  /**
   * La 0.3.0 guardaba sin local, y todo lo de entonces es del principal
   * (A-91): se mueve a la clave del principal para no perder una venta a medias.
   */
  function migrateLegacy() {
    if (!establishments.current?.is_main) return
    try {
      for (const [legacy, key] of [
        [`sunat.sale-draft.${owner.value}`, storageKey.value!],
        [`sunat.sale-preference.${owner.value}`, preferenceKey.value!],
      ] as const) {
        const value = localStorage.getItem(legacy)
        if (value === null) continue
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
        localStorage.removeItem(legacy)
      }
    } catch {
      // Sin almacenamiento no hay nada que mover.
    }
  }

  /** Lee la venta guardada del usuario, la empresa y el local actuales. */
  function load() {
    const key = storageKey.value
    if (!key) {
      // Sin local (o sin sesión): nada en memoria que se pueda cobrar en otro.
      if (loadedKey !== null) {
        loadedKey = null
        preference = { kind: 'ticket', seriesId: null }
        reset()
      }
      return
    }
    if (key === loadedKey) return
    migrateLegacy()
    loadedKey = key
    preference = readPreference(preferenceKey.value!)
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

  /** Guarda lo que hay en memoria en la clave de la que se cargó. */
  function save() {
    const key = loadedKey
    if (!key) return
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
      if (lines.value.length === 0) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(data))
    } catch {
      // Sin almacenamiento la venta dura mientras la app esté abierta.
    }
  }

  watch([lines, kind, seriesId, paymentMethod, customerName, customerDocument, documentCustomer, idempotencyKey], save, {
    deep: true,
  })

  // Cambiar de local: se guarda la venta del anterior tal como está y se carga la del nuevo.
  watch(
    storageKey,
    () => {
      save()
      load()
    },
    { flush: 'sync' },
  )

  /**
   * Recuerda el comprobante y la serie actuales para las próximas ventas. Solo
   * para elecciones del usuario y ventas cobradas: las correcciones automáticas
   * (serie inactiva, SUNAT sin responder) no deben pisar la preferencia.
   */
  function remember() {
    preference = { kind: kind.value, seriesId: seriesId.value }
    try {
      if (preferenceKey.value) localStorage.setItem(preferenceKey.value, JSON.stringify({ v: VERSION, ...preference } satisfies Preference))
    } catch {
      // Sin almacenamiento se recuerda mientras la app esté abierta.
    }
  }

  function add(product: SellableProduct) {
    const existing = lines.value.find((l) => l.product.id === product.id)
    if (existing) {
      existing.quantity = String(Number(existing.quantity || '0') + 1)
      existing.error = null
    } else {
      lines.value.push({ product: sellable(product), quantity: '1', discount: '', error: null })
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
      if (loadedKey) localStorage.removeItem(loadedKey)
    } catch {
      // Nada que borrar.
    }
  }

  /**
   * Al cerrar sesión: borra las ventas en curso del usuario en **todos** los
   * locales (también la de un local desactivado o la de la 0.3.0). La
   * preferencia de comprobante y serie se conserva (A-60).
   */
  function clearAll() {
    reset()
    try {
      const prefix = `sunat.sale-draft.${owner.value}`
      Object.keys(localStorage)
        .filter((key) => owner.value && (key === prefix || key.startsWith(`${prefix}.`)))
        .forEach((key) => localStorage.removeItem(key))
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
        line.product = sellable(result.value)
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
    establishmentId,
    count,
    total,
    load,
    add,
    step,
    remove,
    clear,
    clearAll,
    refresh,
    remember,
  }
})
