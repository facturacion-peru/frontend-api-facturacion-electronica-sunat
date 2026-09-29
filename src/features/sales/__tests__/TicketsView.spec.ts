import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import { today } from '@/shared/utils/format'
import type { Ticket } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ salesApi: { list: vi.fn<AsyncFn>() } }))

const { salesApi } = await import('../api')
const TicketsView = (await import('../views/TicketsView.vue')).default

const row = (overrides: Partial<Ticket>): Ticket => ({
  id: 1, number: 1, display_number: 'T-000001', status: 'issued', legal_notice: 'Documento interno — no es comprobante de pago',
  seller: { id: 2, name: 'Luis' }, customer_name: null, customer_label: 'Cliente varios', customer_document: null, payment_method: 'cash',
  subtotal: '10.00', discount_total: '0.00', total: '10.00', issued_at: '2026-09-28T15:00:00Z', voided_at: null, void_reason: null, ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(salesApi.list).mockResolvedValue({
    success: true,
    data: [row({}), row({ id: 2, display_number: 'T-000002', status: 'voided', total: '5.00' })],
    meta: { current_page: 1, per_page: 25, total: 2, last_page: 1, from: 1, to: 2 },
    totals: { count: 1, total: '10.00', by_payment_method: { cash: '10.00', card: '0.00', yape_plin: '0.00', transfer: '0.00' } },
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('TicketsView', () => {
  it('carga las ventas de hoy con totales por medio de pago', async () => {
    const { wrapper } = await mountWithRouter(TicketsView)

    expect(salesApi.list).toHaveBeenCalledWith({ from: today(), to: today(), status: '', payment_method: '', page: 1 })
    expect(wrapper.find('[data-test="sales-totals"]').text()).toContain('Total (1 ventas)')
    expect(wrapper.find('[data-test="sales-totals"]').text()).toContain('Efectivo')
    expect(wrapper.findAll('[data-test="ticket-row"]')[1]!.text()).toContain('Anulado')
  })

  it('aplica los filtros', async () => {
    const { wrapper } = await mountWithRouter(TicketsView)

    await wrapper.find('#sales-method').setValue('card')
    await wrapper.find('#sales-status').setValue('issued')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(salesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ payment_method: 'card', status: 'issued', page: 1 }))
  })
})
