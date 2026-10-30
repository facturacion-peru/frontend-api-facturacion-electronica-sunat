import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/core/api/errors'
import type { Customer, LookupResult } from '../types'

/*
 * Spec 018 · F005: búsqueda por DNI o RUC mientras se escribe (HU-1 esc. 1 a 3,
 * 5 y 6; RF-005; sin conexión).
 */
const net = vi.hoisted(() => ({ online: true }))
vi.mock('@/core/device', () => ({
  device: () => ({ onConnectionChange: (fn: (online: boolean) => void) => (fn(net.online), () => {}) }),
}))

const { useDocumentLookup, LOOKUP_DELAY_MS } = await import('../composables/useDocumentLookup')

const ferreteria: Customer = {
  id: 5, document_type: '6', document_type_label: 'RUC', document_number: '20100070970', name: 'FERRETERIA EL SOL S.A.C.', address: 'Av. Uno',
  verified: true, verified_at: '2026-10-30T10:00:00-05:00', ruc_status: 'ACTIVO', ruc_condition: 'HABIDO',
}
const lookup = vi.fn<(type: '1' | '6' | '4', number: string, signal: AbortSignal) => Promise<LookupResult>>()

function setup(requireRuc = false) {
  const text = ref('')
  const scope = effectScope()
  const { state } = scope.run(() => useDocumentLookup(text, { lookup, requireRuc }))!
  return { text, state, scope }
}

async function type(text: { value: string }, value: string) {
  text.value = value
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers()
  lookup.mockReset()
  net.online = true
})

afterEach(() => vi.useRealTimers())

describe('useDocumentLookup', () => {
  it('consulta al completar el RUC, tras la pausa, y deja el cliente encontrado', async () => {
    lookup.mockResolvedValue({ customer: ferreteria, source: 'service', reason: null })
    const { text, state } = setup()

    await type(text, '2010007097')
    expect(state.value).toEqual({ status: 'idle' })
    await type(text, '20100070970')
    expect(state.value).toEqual({ status: 'searching', kind: 'ruc' })
    expect(lookup).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS)
    expect(lookup).toHaveBeenCalledWith('6', '20100070970', expect.any(AbortSignal))
    expect(state.value).toEqual({ status: 'found', customer: ferreteria, source: 'service', reason: null })
  })

  it('un DNI consulta como tipo 1; sin resultado queda el motivo', async () => {
    lookup.mockResolvedValue({ customer: null, source: null, reason: 'quota' })
    const { text, state } = setup()

    await type(text, '46027897')
    await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS)

    expect(lookup).toHaveBeenCalledWith('1', '46027897', expect.any(AbortSignal))
    expect(state.value).toEqual({ status: 'missing', kind: 'dni', reason: 'quota' })
  })

  it('seguir escribiendo aborta la búsqueda anterior y su respuesta no pisa a la nueva', async () => {
    let resolveOld!: (r: LookupResult) => void
    lookup
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)))
      .mockResolvedValueOnce({ customer: null, source: null, reason: 'not_found' })
    const { text, state } = setup()

    await type(text, '20100070970')
    await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS)
    const oldSignal = lookup.mock.calls[0]![2]

    await type(text, '20131312955')
    expect(oldSignal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS)
    resolveOld({ customer: ferreteria, source: 'company', reason: null })
    await vi.runAllTimersAsync()

    expect(state.value).toEqual({ status: 'missing', kind: 'ruc', reason: 'not_found' })
  })

  it('RF-005: un RUC inválido avisa sin consultar', async () => {
    const { text, state } = setup()

    await type(text, '20100070971')
    await vi.runAllTimersAsync()

    expect(state.value).toEqual({ status: 'invalid', message: 'El RUC no es válido: revisa los números.' })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('para factura, un DNI avisa sin consultar', async () => {
    const { text, state } = setup(true)

    await type(text, '46027897')
    await vi.runAllTimersAsync()

    expect(state.value).toEqual({ status: 'invalid', message: 'Para factura se necesita un RUC.' })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('un 422 de la API es de formato; otra falla deja registrar a mano', async () => {
    lookup.mockRejectedValueOnce(new ApiError(422, 'x', { document_number: ['El DNI debe tener 8 dígitos.'] }))
    const { text, state } = setup()

    await type(text, '46027897')
    await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS)
    expect(state.value).toEqual({ status: 'invalid', message: 'El DNI debe tener 8 dígitos.' })

    lookup.mockRejectedValueOnce(new ApiError(0, 'Sin conexión'))
    await type(text, '46027898')
    await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS)
    expect(state.value).toEqual({ status: 'missing', kind: 'dni', reason: 'unavailable' })
  })

  it('sin conexión no consulta', async () => {
    net.online = false
    const { text, state } = setup()

    await type(text, '20100070970')
    await vi.runAllTimersAsync()

    expect(state.value).toEqual({ status: 'offline' })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('al cerrar (desmontar) aborta lo pendiente', async () => {
    lookup.mockImplementation(() => new Promise(() => {}))
    const { text, scope } = setup()

    await type(text, '20100070970')
    await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS)
    scope.stop()

    expect(lookup.mock.calls[0]![2].aborted).toBe(true)
  })
})
