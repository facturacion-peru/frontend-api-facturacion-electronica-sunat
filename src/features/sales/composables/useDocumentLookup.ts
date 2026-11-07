import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

import { ApiError } from '@/core/api/errors'
import { device } from '@/core/device'
import { documentKind, isRuc } from '@/shared/utils/documents'
import type { Customer, CustomerDocumentType, LookupResult } from '../types'

/**
 * Búsqueda del cliente por DNI o RUC mientras se escribe (spec 018, HU-1).
 * Al completar 8 u 11 dígitos, y tras una pausa, pide `lookup`; cada búsqueda
 * nueva aborta la anterior y una respuesta tardía nunca pisa a otra más
 * nueva. Un formato inválido se avisa sin pedir nada (RF-005), y sin
 * conexión no se consulta (caso límite).
 */
export type LookupFn = (type: CustomerDocumentType, number: string, signal: AbortSignal) => Promise<LookupResult>

export type LookupState =
  | { status: 'idle' }
  | { status: 'invalid'; message: string }
  | { status: 'searching'; kind: 'dni' | 'ruc' }
  | { status: 'found'; customer: Customer; source: LookupResult['source']; reason: LookupResult['reason'] }
  | { status: 'missing'; kind: 'dni' | 'ruc'; reason: NonNullable<LookupResult['reason']> }
  | { status: 'offline' }

export const LOOKUP_DELAY_MS = 300

export function useDocumentLookup(
  text: Ref<string>,
  { lookup, requireRuc = false }: { lookup: LookupFn; requireRuc?: MaybeRefOrGetter<boolean> },
) {
  const state = ref<LookupState>({ status: 'idle' })
  const online = ref(true)
  onScopeDispose(device().onConnectionChange((value) => (online.value = value)))

  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | null = null

  function cancel() {
    clearTimeout(timer)
    controller?.abort()
    controller = null
  }

  async function run(kind: 'dni' | 'ruc', number: string) {
    controller = new AbortController()
    const { signal } = controller
    try {
      const result = await lookup(kind === 'dni' ? '1' : '6', number, signal)
      if (signal.aborted) return
      state.value = result.customer
        ? { status: 'found', customer: result.customer, source: result.source, reason: result.reason }
        : { status: 'missing', kind, reason: result.reason ?? 'not_found' }
    } catch (e) {
      if (signal.aborted) return
      // Un 422 es de formato; cualquier otra falla deja registrar a mano (RF-010).
      state.value =
        e instanceof ApiError && e.status === 422
          ? { status: 'invalid', message: Object.values(e.fieldErrors)[0]?.[0] ?? e.message }
          : { status: 'missing', kind, reason: 'unavailable' }
    }
  }

  watch(
    text,
    (value) => {
      cancel()
      const number = value.trim()
      const kind = documentKind(number)
      if (!kind) return (state.value = { status: 'idle' })
      if (kind === 'dni' && toValue(requireRuc)) return (state.value = { status: 'invalid', message: 'Para factura se necesita un RUC.' })
      if (kind === 'ruc' && !isRuc(number)) return (state.value = { status: 'invalid', message: 'El RUC no es válido: revisa los números.' })
      if (!online.value) return (state.value = { status: 'offline' })

      state.value = { status: 'searching', kind }
      timer = setTimeout(() => run(kind, number), LOOKUP_DELAY_MS)
    },
  )

  onScopeDispose(cancel)

  return { state }
}
