import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/core/api/errors'

/*
 * Spec 018 · F004: POST /customers/lookup.
 */
const POST = vi.hoisted(() => vi.fn<(path: string, init: unknown) => Promise<unknown>>())
vi.mock('@/core/api/client', () => ({ apiClient: { POST } }))

const { customersApi } = await import('../api')

const reply = (status: number, body: unknown) => ({
  data: status < 400 ? body : undefined,
  error: status >= 400 ? body : undefined,
  response: new Response(null, { status }),
})

describe('customersApi.lookup', () => {
  it('manda el tipo, el número y la señal, y devuelve el cliente con su origen', async () => {
    const customer = { id: 5, name: 'FERRETERIA EL SOL S.A.C.' }
    POST.mockResolvedValue(reply(200, { success: true, data: customer, meta: { source: 'platform', reason: null } }))
    const signal = new AbortController().signal

    expect(await customersApi.lookup('6', '20100070970', signal)).toEqual({ customer, source: 'platform', reason: null })
    expect(POST).toHaveBeenCalledWith('/api/v1/customers/lookup', { body: { document_type: '6', document_number: '20100070970' }, signal })
  })

  it('sin cliente devuelve el motivo', async () => {
    POST.mockResolvedValue(reply(200, { success: true, data: null, meta: { source: null, reason: 'unavailable' } }))

    expect(await customersApi.lookup('1', '46027897')).toEqual({ customer: null, source: null, reason: 'unavailable' })
  })

  it('un formato inválido llega como ApiError 422 con el error del campo', async () => {
    POST.mockResolvedValue(reply(422, { success: false, message: 'Revisa los datos.', errors: { document_number: ['El RUC no es válido.'] } }))

    const error = await customersApi.lookup('6', '20100070971').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).field('document_number')).toBe('El RUC no es válido.')
  })
})
