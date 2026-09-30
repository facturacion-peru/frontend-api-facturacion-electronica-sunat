import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { PlatformAuditEntry, SupportDocument } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ platformApi: { supportDocuments: vi.fn<AsyncFn>(), retry: vi.fn<AsyncFn>(), audit: vi.fn<AsyncFn>() } }))

const { platformApi } = await import('../api')
const SupportView = (await import('../views/SupportView.vue')).default
const PlatformAuditView = (await import('../views/PlatformAuditView.vue')).default

const doc: SupportDocument = {
  id: 5, company: { id: 1, ruc: '20600000013', razon_social: 'Bodega Alfa S.A.C.' }, display_number: 'B001-00000007', document_type: '03',
  document_type_label: 'Boleta de venta', status: 'pending', status_label: 'Pendiente de envío', sunat_code: 'HTTP', sunat_message: 'Could not connect',
  attempts: 3, issued_at: '2026-09-29T15:00:00+00:00', next_attempt_at: null, can_retry: true,
}
const page = <T>(data: T[]) => ({ success: true as const, data, meta: { current_page: 1, per_page: 25, total: data.length, last_page: 1, from: 1, to: data.length } })

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SupportView', () => {
  it('lista los comprobantes con problemas y su empresa, y filtra por la empresa de la URL', async () => {
    vi.mocked(platformApi.supportDocuments).mockResolvedValue(page([doc]))
    const { wrapper } = await mountWithRouter(SupportView, { path: '/plataforma/soporte?empresa=1', pattern: '/plataforma/soporte' })

    expect(platformApi.supportDocuments).toHaveBeenCalledWith(expect.objectContaining({ company_id: 1 }))
    expect(wrapper.find('[data-test="support-row"]').text()).toContain('Bodega Alfa S.A.C.')
    expect(wrapper.find('[data-test="support-row"]').text()).toContain('3 intentos')
  })

  it('reintenta y muestra el resultado', async () => {
    vi.mocked(platformApi.supportDocuments).mockResolvedValueOnce(page([doc])).mockResolvedValueOnce(page([]))
    vi.mocked(platformApi.retry).mockResolvedValue({ ...doc, status: 'accepted', status_label: 'Aceptado', can_retry: false })
    const { wrapper } = await mountWithRouter(SupportView)

    await wrapper.findAll('button').find((b) => b.text() === 'Reintentar')!.trigger('click')
    await flushPromises()

    expect(platformApi.retry).toHaveBeenCalledWith(5)
    expect(wrapper.text()).toContain('B001-00000007 de Bodega Alfa S.A.C.: Aceptado.')
    expect(wrapper.text()).toContain('No hay comprobantes con problemas')
  })

  it('muestra el 409 de un envío en curso', async () => {
    vi.mocked(platformApi.supportDocuments).mockResolvedValue(page([doc]))
    vi.mocked(platformApi.retry).mockRejectedValue(new ApiError(409, 'Este comprobante ya se está enviando a SUNAT.'))
    const { wrapper } = await mountWithRouter(SupportView)

    await wrapper.findAll('button').find((b) => b.text() === 'Reintentar')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ya se está enviando')
  })
})

describe('PlatformAuditView', () => {
  it('muestra las acciones con su empresa y el motivo, y filtra por acción', async () => {
    const entry: PlatformAuditEntry = {
      id: 1, action: 'company.deactivated', actor: { id: 1, name: 'Raúl' }, changes: { reason: 'Falta de pago' }, ip: '10.0.0.1',
      created_at: '2026-09-29T15:00:00+00:00', company: { id: 1, razon_social: 'Bodega Alfa S.A.C.' },
    }
    vi.mocked(platformApi.audit).mockResolvedValue(page([entry]))
    const { wrapper } = await mountWithRouter(PlatformAuditView)

    const row = wrapper.find('[data-test="audit-row"]').text()
    expect(row).toContain('Suspensión · Bodega Alfa S.A.C.')
    expect(row).toContain('Motivo: Falta de pago')

    await wrapper.find('#audit-action').setValue('auth.login')
    await flushPromises()
    expect(platformApi.audit).toHaveBeenLastCalledWith({ action: 'auth.login', page: 1 })
  })
})
