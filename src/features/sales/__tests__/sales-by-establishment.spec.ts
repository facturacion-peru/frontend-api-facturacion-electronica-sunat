import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { principal, sessionWith, sucursal } from '@/shared/testing/establishments'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SalesDocument, Ticket } from '../types'

/*
 * Spec 017 · F010: el local en las listas, el detalle y el recibo de tickets y
 * comprobantes (HU-2 esc. 3, HU-4 y A-90). Con un solo local, nada cambia.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  salesApi: { list: vi.fn<AsyncFn>() },
  salesDocumentsApi: { list: vi.fn<AsyncFn>() },
}))
vi.mock('@/shared/establishments/api', () => ({ establishmentsApi: { list: vi.fn<AsyncFn>() } }))

const { salesApi, salesDocumentsApi } = await import('../api')
const { establishmentsApi } = await import('@/shared/establishments/api')
const TicketsView = (await import('../views/TicketsView.vue')).default
const SalesDocumentsView = (await import('../views/SalesDocumentsView.vue')).default
const TicketReceipt = (await import('../components/TicketReceipt.vue')).default

const ticket = {
  id: 1, display_number: 'T-000001', status: 'issued', legal_notice: 'Documento interno', seller: { id: 2, name: 'Luis' },
  customer_label: 'Cliente varios', customer_document: null, payment_method: 'cash', total: '10.00', discount_total: '0.00',
  issued_at: '2026-10-29T15:00:00Z', lines: [], establishment: { id: 2, code: '0001', name: 'Sucursal Centro', address: 'Jr. Unión 45' },
} as unknown as Ticket
const salesDocument = {
  id: 31, display_number: 'B002-00000001', status: 'accepted', status_label: 'Aceptado', correction_status: 'none',
  customer: { name: 'CLIENTES VARIOS' }, seller: { id: 2, name: 'Luis' }, total: '10.00', issued_at: '2026-10-29T15:00:00Z',
  establishment: { id: 2, code: '0001', name: 'Sucursal Centro' },
} as unknown as SalesDocument
const meta = { current_page: 1, per_page: 25, total: 1, last_page: 1, from: 1, to: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(establishmentsApi.list).mockResolvedValue([principal, sucursal])
  vi.mocked(salesApi.list).mockResolvedValue({
    success: true, data: [ticket], meta,
    totals: { count: 1, total: '10.00', by_payment_method: { cash: '10.00', card: '0.00', yape_plin: '0.00', transfer: '0.00' } },
  })
  vi.mocked(salesDocumentsApi.list).mockResolvedValue({ success: true, data: [salesDocument], meta, counts: { pending: 0, rejected: 0 } })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('listas de ventas con varios locales', () => {
  it('«Ventas» filtra por local y cada fila dice su local', async () => {
    const { wrapper } = await mountWithRouter(TicketsView, { beforeMount: () => sessionWith([principal, sucursal]) })

    expect(salesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ establishment_id: null }))
    expect(wrapper.get('[data-test="row-establishment"]').text()).toContain('Sucursal Centro')

    await wrapper.get('#sales-establishment').setValue('2')
    await wrapper.get('form').trigger('submit')
    expect(salesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ establishment_id: 2, page: 1 }))
  })

  it('«Comprobantes» empieza en el local del vendedor (A-87) y cada fila dice su local', async () => {
    const { wrapper } = await mountWithRouter(SalesDocumentsView, { beforeMount: () => sessionWith([sucursal], 'seller', 2) })

    expect(salesDocumentsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ establishment_id: 2 }))
    expect(wrapper.get('[data-test="row-establishment"]').text()).toContain('Sucursal Centro')
  })

  it('RF-010: con un solo local no hay filtro ni local en las filas', async () => {
    const { wrapper } = await mountWithRouter(TicketsView, { beforeMount: () => sessionWith([principal]) })

    expect(wrapper.find('#sales-establishment').exists()).toBe(false)
    expect(wrapper.find('[data-test="row-establishment"]').exists()).toBe(false)
  })
})

describe('recibo del ticket (como el PDF de la API)', () => {
  const mountReceipt = (establishment: Ticket['establishment']) => {
    setActivePinia(createPinia())
    sessionWith([principal, sucursal])
    return mount(TicketReceipt, { props: { ticket: { ...ticket, establishment }, companyName: 'Demo', companyRuc: '20600000011' } })
  }

  it('un ticket de otro local lleva su nombre y dirección', () => {
    const receipt = mountReceipt(ticket.establishment).get('[data-test="receipt-establishment"]')

    expect(receipt.text()).toBe('Sucursal Centro')
    expect(receipt.element.nextElementSibling!.textContent).toBe('Jr. Unión 45')
  })

  it('un ticket del principal se imprime como siempre', () => {
    const wrapper = mountReceipt({ id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123' })

    expect(wrapper.find('[data-test="receipt-establishment"]').exists()).toBe(false)
  })
})
