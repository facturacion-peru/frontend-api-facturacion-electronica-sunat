import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { useSessionStore } from '@/core/auth/session-store'
import type { CompanyRole } from '@/core/auth/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SalesDocument } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  salesDocumentsApi: { get: vi.fn<AsyncFn>(), retry: vi.fn<AsyncFn>(), download: vi.fn<AsyncFn>(), creditNote: vi.fn<AsyncFn>(), discard: vi.fn<AsyncFn>() },
}))

const { salesDocumentsApi } = await import('../api')
const SalesDocumentView = (await import('../views/SalesDocumentView.vue')).default

const boleta: SalesDocument = {
  id: 31, document_type: '03', document_type_label: 'Boleta de venta', series_code: 'B001', number: 151, display_number: 'B001-00000151',
  environment: 'beta', environment_notice: 'PRUEBAS — sin valor legal', issued_at: '2026-09-30T15:00:00+00:00', seller: { id: 2, name: 'Luis' },
  payment_method: 'cash', currency: 'PEN', customer: { id: null, document_type: '0', document_number: '-', name: 'CLIENTES VARIOS', address: null },
  op_gravadas: '24.58', op_exoneradas: '13.50', op_inafectas: '0.00', igv: '4.42', discount_total: '1.00', total: '42.50',
  status: 'accepted', status_label: 'Aceptado', sunat_code: '0', sunat_message: 'aceptada', sunat_notes: [], hash: 'h', has_cdr: true, attempts: 1,
  next_attempt_at: null, can_retry: false, correction_status: 'partially_returned', correction_status_label: 'Devuelto parcialmente', can_credit: true,
  note_reason_code: null, note_reason_label: null, note_reason: null, restock: null, discard_reason: null, reference: null,
  credit_notes: [{ id: 40, display_number: 'BC01-00000001', note_reason_label: 'Devolución por ítem', status: 'accepted', status_label: 'Aceptado', total: '7.25', issued_at: '2026-09-30T16:00:00+00:00' }],
  lines: [
    { position: 1, product_code: 'Y', product_name: 'Yogur', unit: 'NIU', igv_affectation: '10', quantity: '4.000', unit_price: '7.50', discount: '1.00', base_amount: '24.58', igv: '4.42', amount: '29.00', remaining: '3.000' },
    { position: 2, product_code: 'L', product_name: 'Leche', unit: 'NIU', igv_affectation: '20', quantity: '3.000', unit_price: '4.50', discount: '0.00', base_amount: '13.50', igv: '0.00', amount: '13.50', remaining: '3.000' },
  ],
  submissions: [],
}
const note: SalesDocument = {
  ...boleta, id: 41, document_type: '07', document_type_label: 'Nota de crédito', series_code: 'BC01', display_number: 'BC01-00000002', total: '7.50',
  correction_status: 'none', correction_status_label: 'Vigente', can_credit: false, note_reason_code: '07', note_reason_label: 'Devolución por ítem',
  note_reason: 'Producto dañado', restock: true, reference: { id: 31, document_type: '03', display_number: 'B001-00000151' }, credit_notes: [],
  lines: [{ ...boleta.lines![1]!, quantity: '1.000', remaining: null }],
}

async function open(document: SalesDocument, role: CompanyRole = 'seller') {
  vi.mocked(salesDocumentsApi.get).mockResolvedValue(document)
  return mountWithRouter(SalesDocumentView, {
    path: `/ventas/comprobantes/${document.id}`,
    pattern: '/ventas/comprobantes/:id',
    beforeMount: () => {
      useSessionStore().session = { user: { id: 2, name: 'Luis', email: 'l@demo.test' }, platform_admin: false, company: { id: 1, ruc: '20600000013', razon_social: 'Demo', nombre_comercial: null }, role }
    },
  })
}

function body(): HTMLElement {
  return document.body
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Notas de crédito en el detalle del comprobante', () => {
  it('muestra el estado de corrección, lo que queda por devolver y sus notas', async () => {
    const { wrapper } = await open(boleta)

    expect(wrapper.find('[data-test="correction"]').text()).toBe('Devuelto parcialmente')
    expect(wrapper.findAll('[data-test="line"]')[0]!.text()).toContain('Quedan 3 por devolver')
    expect(wrapper.find('[data-test="credit-notes"]').text()).toContain('BC01-00000001')
    expect(wrapper.find('[data-test="credit-actions"]').exists()).toBe(true) // A-41: también el vendedor
  })

  it('registra una devolución parcial y abre la nota emitida', async () => {
    vi.mocked(salesDocumentsApi.creditNote).mockResolvedValue(note)
    const { wrapper, router } = await open(boleta)

    await wrapper.findAll('button').find((b) => b.text() === 'Registrar devolución')!.trigger('click')
    await flushPromises()
    const qty = body().querySelector<HTMLInputElement>('#return-2')!
    qty.value = '1'
    qty.dispatchEvent(new Event('input'))
    const reason = body().querySelector<HTMLInputElement>('#credit-reason')!
    reason.value = 'Producto dañado'
    reason.dispatchEvent(new Event('input'))
    body().querySelector<HTMLFormElement>('#credit-note-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(salesDocumentsApi.creditNote).toHaveBeenCalledWith(31, expect.objectContaining({
      reason_code: '07', reason: 'Producto dañado', lines: [{ line_position: 2, quantity: '1' }],
    }))
    expect(router.currentRoute.value.params.id).toBe('41')
  })

  it('«devolver todo» emite el motivo 06', async () => {
    vi.mocked(salesDocumentsApi.creditNote).mockResolvedValue(note)
    const { wrapper } = await open(boleta)

    await wrapper.findAll('button').find((b) => b.text() === 'Registrar devolución')!.trigger('click')
    await flushPromises()
    body().querySelector<HTMLInputElement>('#credit-return-all')!.click()
    body().querySelector<HTMLFormElement>('#credit-note-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(salesDocumentsApi.creditNote).toHaveBeenCalledWith(31, expect.objectContaining({ reason_code: '06' }))
  })

  it('anula indicando si la mercadería volvió', async () => {
    vi.mocked(salesDocumentsApi.creditNote).mockResolvedValue(note)
    const { wrapper } = await open(boleta)

    await wrapper.findAll('button').find((b) => b.text() === 'Anular')!.trigger('click')
    await flushPromises()
    body().querySelector<HTMLInputElement>('#credit-restock')!.click()
    body().querySelector<HTMLFormElement>('#credit-note-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(salesDocumentsApi.creditNote).toHaveBeenCalledWith(31, expect.objectContaining({ reason_code: '01', restock: false }))
  })

  it('ubica en su línea el error de cantidad de la API', async () => {
    vi.mocked(salesDocumentsApi.creditNote).mockRejectedValue(new ApiError(422, 'x', { 'lines.0.quantity': ['Solo quedan 3 por devolver de esta línea.'] }))
    const { wrapper } = await open(boleta)

    await wrapper.findAll('button').find((b) => b.text() === 'Registrar devolución')!.trigger('click')
    await flushPromises()
    const qty = body().querySelector<HTMLInputElement>('#return-1')!
    qty.value = '9'
    qty.dispatchEvent(new Event('input'))
    body().querySelector<HTMLFormElement>('#credit-note-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(body().querySelector('[data-test="return-lines"]')!.textContent).toContain('Solo quedan 3 por devolver')
  })

  it('la nota muestra el comprobante que modifica y no ofrece devoluciones', async () => {
    const { wrapper } = await open(note)

    expect(wrapper.find('[data-test="reference"]').text()).toContain('Modifica B001-00000151')
    expect(wrapper.find('[data-test="reference"]').text()).toContain('Devolución por ítem: Producto dañado')
    expect(wrapper.find('[data-test="credit-actions"]').exists()).toBe(false)
  })
})

describe('Descartar un rechazado (A-42)', () => {
  const rejected: SalesDocument = { ...boleta, status: 'rejected', status_label: 'Rechazado', can_credit: false, correction_status: 'none', credit_notes: [] }

  it('solo el administrador ve «Descartar»', async () => {
    const seller = await open(rejected, 'seller')
    expect(seller.wrapper.findAll('button').some((b) => b.text() === 'Descartar')).toBe(false)
    document.body.innerHTML = ''

    const admin = await open(rejected, 'company_admin')
    expect(admin.wrapper.findAll('button').some((b) => b.text() === 'Descartar')).toBe(true)
  })

  it('descarta con motivo y muestra el resultado', async () => {
    vi.mocked(salesDocumentsApi.discard).mockResolvedValue({ ...rejected, status: 'discarded', status_label: 'Descartado', discard_reason: 'DNI mal escrito' })
    const { wrapper } = await open(rejected, 'company_admin')

    await wrapper.findAll('button').find((b) => b.text() === 'Descartar')!.trigger('click')
    await flushPromises()
    const reason = body().querySelector<HTMLInputElement>('#discard-reason')!
    reason.value = 'DNI mal escrito'
    reason.dispatchEvent(new Event('input'))
    body().querySelector<HTMLFormElement>('#discard-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(salesDocumentsApi.discard).toHaveBeenCalledWith(31, 'DNI mal escrito')
    expect(wrapper.find('[data-test="result"]').text()).toContain('Descartado: DNI mal escrito')
  })
})
