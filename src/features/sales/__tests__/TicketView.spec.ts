import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { useSessionStore } from '@/core/auth/session-store'
import type { CompanyRole } from '@/core/auth/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Ticket } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ salesApi: { get: vi.fn<AsyncFn>(), void: vi.fn<AsyncFn>() } }))

const { salesApi } = await import('../api')
const TicketView = (await import('../views/TicketView.vue')).default

const ticket: Ticket = {
  id: 9, number: 9, display_number: 'T-000009', status: 'issued', legal_notice: 'Documento interno — no es comprobante de pago',
  seller: { id: 2, name: 'Luis' }, customer_name: null, customer_label: 'Cliente varios', customer_document: null,
  payment_method: 'yape_plin', subtotal: '10.55', discount_total: '0.97', total: '9.58', issued_at: '2026-09-28T15:00:00Z',
  voided_at: null, void_reason: null,
  lines: [
    { product_id: 1, product_code: 'GAL-1', product_name: 'Galletas', unit: 'NIU', quantity: '3.000', unit_price: '2.99', gross_amount: '8.97', discount: '0.97', amount: '8.00' },
  ],
}

async function mountAs(role: CompanyRole, query = '') {
  return mountWithRouter(TicketView, {
    path: `/ventas/9${query}`,
    pattern: '/ventas/:id',
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Ana', email: 'ana@demo.test' }, platform_admin: false,
        company: { id: 1, ruc: '20600000011', razon_social: 'Empresa Demo S.A.C.', nombre_comercial: 'Bodega Demo' }, role,
      }
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(salesApi.get).mockResolvedValue(ticket)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('TicketView', () => {
  it('muestra el ticket con la leyenda de documento interno y nunca «boleta» ni «factura»', async () => {
    const { wrapper } = await mountAs('seller', '?nueva=1')

    expect(wrapper.text()).toContain('Venta registrada.')
    expect(wrapper.find('[data-test="legal-notice"]').text()).toBe('Documento interno — no es comprobante de pago')
    expect(wrapper.text()).toContain('TICKET T-000009')
    expect(wrapper.text()).toContain('Cliente varios')
    expect(wrapper.text()).toContain('Yape / Plin')
    expect(wrapper.text().toLowerCase()).not.toMatch(/boleta|factura/)
  })

  it('imprime con el navegador', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { wrapper } = await mountAs('seller')

    await wrapper.findAll('button').find((b) => b.text() === 'Imprimir')!.trigger('click')

    expect(printSpy).toHaveBeenCalled()
  })

  it('el vendedor no puede anular', async () => {
    const { wrapper } = await mountAs('seller')

    expect(wrapper.findAll('button').some((b) => b.text() === 'Anular')).toBe(false)
  })

  it('el administrador anula con motivo y el ticket muestra ANULADO', async () => {
    vi.mocked(salesApi.void).mockResolvedValue({ ...ticket, status: 'voided', void_reason: 'Error de cobro' })
    const { wrapper } = await mountAs('company_admin')

    await wrapper.findAll('button').find((b) => b.text() === 'Anular')!.trigger('click')
    await flushPromises()
    const input = document.getElementById('void-reason') as HTMLInputElement
    input.value = 'Error de cobro'
    input.dispatchEvent(new Event('input'))
    document.getElementById('void-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(salesApi.void).toHaveBeenCalledWith(9, 'Error de cobro')
    expect(wrapper.find('[data-test="voided-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="legal-notice"]').exists()).toBe(true)
  })
})
