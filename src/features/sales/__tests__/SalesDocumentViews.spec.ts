import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SalesDocument } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  salesDocumentsApi: { list: vi.fn<AsyncFn>(), get: vi.fn<AsyncFn>(), retry: vi.fn<AsyncFn>(), download: vi.fn<AsyncFn>() },
}))

const { salesDocumentsApi } = await import('../api')
const SalesDocumentsView = (await import('../views/SalesDocumentsView.vue')).default
const SalesDocumentView = (await import('../views/SalesDocumentView.vue')).default

const base: SalesDocument = {
  id: 31, document_type: '03', document_type_label: 'Boleta de venta', series_code: 'B001', number: 151, display_number: 'B001-00000151',
  environment: 'beta', environment_notice: 'PRUEBAS — sin valor legal', issued_at: '2026-09-29T15:00:00+00:00', seller: { id: 2, name: 'Luis' },
  payment_method: 'cash', currency: 'PEN', customer: { id: null, document_type: '0', document_number: '-', name: 'CLIENTES VARIOS', address: null },
  op_gravadas: '43.90', op_exoneradas: '13.50', op_inafectas: '0.00', igv: '7.90', discount_total: '0.00', total: '65.30',
  status: 'accepted', status_label: 'Aceptado', sunat_code: '0', sunat_message: 'La Boleta numero B001-151, ha sido aceptada', sunat_notes: [],
  hash: 'abc=', has_cdr: true, attempts: 1, next_attempt_at: null, can_retry: false,
  correction_status: 'none', correction_status_label: 'Vigente', can_credit: true, note_reason_code: null, note_reason_label: null,
  note_reason: null, restock: null, discard_reason: null, reference: null, credit_notes: [],
  lines: [
    { position: 1, product_code: 'ARZ', product_name: 'Arroz 5 kg', unit: 'NIU', igv_affectation: '10', quantity: '2.000', unit_price: '25.90', discount: '0.00', base_amount: '43.90', igv: '7.90', amount: '51.80', remaining: '2.000' },
    { position: 2, product_code: 'LEC', product_name: 'Leche', unit: 'NIU', igv_affectation: '20', quantity: '3.000', unit_price: '4.50', discount: '0.00', base_amount: '13.50', igv: '0.00', amount: '13.50', remaining: '3.000' },
  ],
  submissions: [{ trigger: 'issue', started_at: '2026-09-29T15:00:01+00:00', duration_ms: 210, result: 'accepted', code: '0', message: 'aceptada' }],
}
const pending: SalesDocument = { ...base, id: 32, status: 'pending', status_label: 'Pendiente de envío', sunat_code: 'HTTP', sunat_message: 'Could not connect', has_cdr: false, can_retry: true, next_attempt_at: '2026-09-29T15:01:00+00:00' }

const page = (data: SalesDocument[], counts = { pending: 0, rejected: 0 }) => ({
  success: true as const, data, meta: { current_page: 1, per_page: 25, total: data.length, last_page: 1, from: 1, to: data.length }, counts,
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SalesDocumentsView', () => {
  it('lista los comprobantes con estado y total, dentro de la pestaña Comprobantes', async () => {
    vi.mocked(salesDocumentsApi.list).mockResolvedValue(page([base, pending]))
    const { wrapper } = await mountWithRouter(SalesDocumentsView)

    const rows = wrapper.findAll('[data-test="document-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[1]!.text()).toContain('Pendiente de envío')
    expect(wrapper.find('nav[aria-label="Tipo de venta"]').text()).toContain('Comprobantes')
    expect(wrapper.find('[data-test="environment-badge"]').exists()).toBe(true)
  })

  it('resalta pendientes y rechazados y filtra con un toque', async () => {
    vi.mocked(salesDocumentsApi.list).mockResolvedValue(page([pending], { pending: 1, rejected: 2 }))
    const { wrapper } = await mountWithRouter(SalesDocumentsView)

    expect(wrapper.find('[data-test="attention"]').text()).toContain('1 pendiente de envío')
    expect(wrapper.find('[data-test="attention"]').text()).toContain('2 rechazados por SUNAT')

    await wrapper.findAll('button').find((b) => b.text() === 'Ver rechazados')!.trigger('click')
    await flushPromises()

    expect(salesDocumentsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'rejected', page: 1 }))
  })

  it('filtra por tipo y cliente', async () => {
    vi.mocked(salesDocumentsApi.list).mockResolvedValue(page([]))
    const { wrapper } = await mountWithRouter(SalesDocumentsView)

    await wrapper.find('#docs-type').setValue('01')
    await wrapper.find('#docs-customer').setValue('ferre')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(salesDocumentsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ document_type: '01', customer: 'ferre' }))
    expect(wrapper.text()).toContain('No hay comprobantes con estos filtros')
  })
})

describe('SalesDocumentView', () => {
  const open = (query = '') => mountWithRouter(SalesDocumentView, { path: `/ventas/comprobantes/31${query}`, pattern: '/ventas/comprobantes/:id' })

  it('recién emitido y aceptado: lo confirma, con totales por afectación y la marca de pruebas', async () => {
    vi.mocked(salesDocumentsApi.get).mockResolvedValue(base)
    const { wrapper } = await open('?nueva=1')

    expect(wrapper.find('[data-test="result"]').text()).toContain('SUNAT aceptó el comprobante.')
    expect(wrapper.find('[data-test="environment-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="totals"]').text()).toContain('Op. exoneradas')
    expect(wrapper.findAll('[data-test="line"]')[1]!.text()).toContain('Exonerado')
    expect(wrapper.find('[data-test="actions"]').text()).not.toContain('Reintentar')
  })

  it('pendiente: explica que se reenviará y permite reintentar', async () => {
    vi.mocked(salesDocumentsApi.get).mockResolvedValue(pending)
    vi.mocked(salesDocumentsApi.retry).mockResolvedValue({ ...base, id: 32 })
    const { wrapper } = await open()

    expect(wrapper.find('[data-test="result"]').text()).toContain('se reenviará automáticamente')
    expect(wrapper.find('[data-test="actions"]').text()).not.toContain('CDR')

    await wrapper.findAll('button').find((b) => b.text() === 'Reintentar')!.trigger('click')
    await flushPromises()

    expect(salesDocumentsApi.retry).toHaveBeenCalledWith(32)
    expect(wrapper.find('[data-test="status"]').text()).toBe('Aceptado')
  })

  it('reintentar con un envío en curso muestra el mensaje de la API', async () => {
    vi.mocked(salesDocumentsApi.get).mockResolvedValue(pending)
    vi.mocked(salesDocumentsApi.retry).mockRejectedValue(new ApiError(409, 'Este comprobante ya se está enviando a SUNAT.'))
    const { wrapper } = await open()

    await wrapper.findAll('button').find((b) => b.text() === 'Reintentar')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Este comprobante ya se está enviando a SUNAT.')
  })

  it('rechazado: muestra el código y el motivo', async () => {
    vi.mocked(salesDocumentsApi.get).mockResolvedValue({
      ...base, status: 'rejected', status_label: 'Rechazado', sunat_code: '2800', sunat_message: 'El tipo de documento del receptor no es válido', has_cdr: false,
    })
    const { wrapper } = await open()

    expect(wrapper.find('[data-test="result"]').text()).toContain('Código 2800: El tipo de documento del receptor no es válido')
  })

  it('observado: lista las observaciones', async () => {
    vi.mocked(salesDocumentsApi.get).mockResolvedValue({ ...base, status: 'observed', status_label: 'Aceptado con observaciones', sunat_notes: ['4287 - precio'] })
    const { wrapper } = await open()

    expect(wrapper.find('[data-test="notes"]').text()).toContain('4287 - precio')
  })

  it('descarga PDF, XML y CDR', async () => {
    vi.mocked(salesDocumentsApi.get).mockResolvedValue(base)
    vi.mocked(salesDocumentsApi.download).mockResolvedValue(undefined)
    const { wrapper } = await open()

    for (const label of ['PDF A4', 'PDF 80 mm', 'XML', 'CDR']) {
      await wrapper.findAll('button').find((b) => b.text() === label)!.trigger('click')
    }
    await flushPromises()

    expect(vi.mocked(salesDocumentsApi.download).mock.calls.map((c) => c[1])).toEqual(['a4', '80mm', 'xml', 'cdr'])
  })
})
