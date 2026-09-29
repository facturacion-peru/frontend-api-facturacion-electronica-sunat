import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SellableProduct } from '../api'
import type { Customer, IssuingAvailability, SalesDocument, Ticket } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  salesApi: { searchProducts: vi.fn<AsyncFn>(), issue: vi.fn<AsyncFn>() },
  salesDocumentsApi: { availability: vi.fn<AsyncFn>(), issue: vi.fn<AsyncFn>() },
  customersApi: { search: vi.fn<AsyncFn>(), create: vi.fn<AsyncFn>() },
}))

const { salesApi, salesDocumentsApi, customersApi } = await import('../api')
const NewSaleView = (await import('../views/NewSaleView.vue')).default

const galletas: SellableProduct = { id: 1, code: 'GAL-1', name: 'Galletas', type: 'good', unit: 'NIU', sale_price: '2.99', available_stock: '10.000' }
const azucar: SellableProduct = { id: 2, code: 'AZU-1', name: 'Azúcar', type: 'good', unit: 'KGM', sale_price: '4.20', available_stock: '5.000' }
const agotado: SellableProduct = { id: 3, code: 'AGO-1', name: 'Agotado', type: 'good', unit: 'NIU', sale_price: '1.00', available_stock: '0.000' }

const ticket = { id: 9, display_number: 'T-000009' } as Ticket

const available: IssuingAvailability = {
  can_issue: true,
  status_label: 'Validada',
  series: [
    { id: 11, document_type: '03', code: 'B001', active: true },
    { id: 12, document_type: '01', code: 'F001', active: true },
  ],
}
const ferreteria: Customer = { id: 5, document_type: '6', document_type_label: 'RUC', document_number: '20100070970', name: 'FERRETERIA EL SOL S.A.C.', address: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(salesApi.searchProducts).mockResolvedValue([galletas, azucar, agotado])
  vi.mocked(salesDocumentsApi.availability).mockResolvedValue(available)
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function addProducts(wrapper: VueWrapper, names: string[]) {
  for (const name of names) {
    await wrapper.find('#sale-search').setValue(name)
    await wrapper.find('#sale-search').trigger('input')
    vi.advanceTimersByTime(300)
    await flushPromises()
    const button = wrapper.findAll('[data-test="search-results"] button').find((b) => b.text().includes(name))!
    await button.trigger('click')
  }
}

describe('NewSaleView', () => {
  it('agrega productos, ajusta cantidades y muestra la vista previa del total', async () => {
    const { wrapper } = await mountWithRouter(NewSaleView)

    await addProducts(wrapper, ['Galletas', 'Azúcar'])
    await wrapper.findAll('[data-test="cart-line"]')[0]!.find('button[aria-label^="Agregar"]').trigger('click')
    await wrapper.findAll('[data-test="cart-line"]')[0]!.find('button[aria-label^="Agregar"]').trigger('click')
    await wrapper.find('#disc-1').setValue('0.97')
    await wrapper.find('#qty-2').setValue('0.375')

    expect(wrapper.find('[data-test="sale-total"]').text()).toMatch(/9\.58/) // 8.00 + 1.58
  })

  it('no permite agregar productos sin disponible', async () => {
    const { wrapper } = await mountWithRouter(NewSaleView)

    await wrapper.find('#sale-search').setValue('Ago')
    await wrapper.find('#sale-search').trigger('input')
    vi.advanceTimersByTime(300)
    await flushPromises()

    const button = wrapper.findAll('[data-test="search-results"] button').find((b) => b.text().includes('Agotado'))!
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('cobra y va al ticket', async () => {
    vi.mocked(salesApi.issue).mockResolvedValue(ticket)
    const { wrapper, router } = await mountWithRouter(NewSaleView)
    const push = vi.spyOn(router, 'push')

    await addProducts(wrapper, ['Galletas'])
    await wrapper.find('input[value="yape_plin"]').setValue(true)
    await wrapper.findAll('button').find((b) => b.text() === 'Cobrar')!.trigger('click')
    await flushPromises()

    expect(salesApi.issue).toHaveBeenCalledWith(expect.objectContaining({
      payment_method: 'yape_plin',
      lines: [{ product_id: 1, quantity: '1' }],
      idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }))
    expect(push).toHaveBeenCalledWith({ name: 'ticket-detail', params: { id: 9 }, query: { nueva: '1' } })
  })

  it('reintenta con la misma clave si la conexión falla', async () => {
    vi.mocked(salesApi.issue).mockRejectedValueOnce(new ApiError(0, 'No se pudo conectar con el servidor.')).mockResolvedValueOnce(ticket)
    const { wrapper } = await mountWithRouter(NewSaleView)
    await addProducts(wrapper, ['Galletas'])
    const charge = () => wrapper.findAll('button').find((b) => b.text() === 'Cobrar')!.trigger('click')

    await charge()
    await flushPromises()
    expect(wrapper.text()).toContain('No se pudo conectar')

    await charge()
    await flushPromises()

    const [first, second] = vi.mocked(salesApi.issue).mock.calls.map((call) => (call[0] as { idempotency_key: string }).idempotency_key)
    expect(second).toBe(first)
  })

  it('marca la línea sin stock suficiente con el disponible de la API', async () => {
    vi.mocked(salesApi.issue).mockRejectedValue(
      new ApiError(422, 'Stock insuficiente', { quantity: ['Solo hay 5.000 disponible de Azúcar.'] }, { available: '5.000', product_id: 2 }),
    )
    const { wrapper } = await mountWithRouter(NewSaleView)
    await addProducts(wrapper, ['Galletas', 'Azúcar'])

    await wrapper.findAll('button').find((b) => b.text() === 'Cobrar')!.trigger('click')
    await flushPromises()

    const lines = wrapper.findAll('[data-test="cart-line"]')
    expect(lines[1]!.text()).toContain('Solo hay 5 disponible.')
    expect(lines[0]!.find('[role="alert"]').exists()).toBe(false)
  })

  it('ubica los errores de validación en su línea', async () => {
    vi.mocked(salesApi.issue).mockRejectedValue(new ApiError(422, 'x', { 'lines.0.discount': ['El descuento no puede superar el importe de la línea (2.99).'] }))
    const { wrapper } = await mountWithRouter(NewSaleView)
    await addProducts(wrapper, ['Galletas'])

    await wrapper.findAll('button').find((b) => b.text() === 'Cobrar')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="cart-line"]').text()).toContain('El descuento no puede superar')
  })

  describe('boleta y factura (spec 005)', () => {
    async function choose(wrapper: VueWrapper, label: string) {
      const input = wrapper.findAll('[data-test="sale-kind"] label').find((l) => l.text() === label)!.find('input')
      await input.setValue(true)
    }

    it('emite una boleta a Cliente varios y va al comprobante', async () => {
      vi.mocked(salesDocumentsApi.issue).mockResolvedValue({ id: 31, display_number: 'B001-00000151' } as SalesDocument)
      const { wrapper, router } = await mountWithRouter(NewSaleView)
      await addProducts(wrapper, ['Galletas'])

      await choose(wrapper, 'Boleta')
      expect(wrapper.find('[data-test="environment-badge"]').exists()).toBe(true)
      await wrapper.findAll('button').find((b) => b.text() === 'Emitir boleta')!.trigger('click')
      await flushPromises()

      expect(salesDocumentsApi.issue).toHaveBeenCalledWith(expect.objectContaining({
        document_type: '03', series_id: 11, customer_id: null, payment_method: 'cash', lines: [{ product_id: 1, quantity: '1' }],
      }))
      expect(router.currentRoute.value.name).toBe('sales-document-detail')
    })

    it('la factura exige un cliente con RUC', async () => {
      vi.mocked(customersApi.search).mockResolvedValue([ferreteria])
      vi.mocked(salesDocumentsApi.issue).mockResolvedValue({ id: 32 } as SalesDocument)
      const { wrapper } = await mountWithRouter(NewSaleView)
      await addProducts(wrapper, ['Galletas'])
      await choose(wrapper, 'Factura')

      const emit = () => wrapper.findAll('button').find((b) => b.text() === 'Emitir factura')!
      expect(emit().attributes('disabled')).toBeDefined()

      await wrapper.find('#customer-search').setValue('ferre')
      await wrapper.find('#customer-search').trigger('input')
      vi.advanceTimersByTime(300)
      await flushPromises()
      await wrapper.find('[data-test="customer-results"] button').trigger('click')
      await emit().trigger('click')
      await flushPromises()

      expect(salesDocumentsApi.issue).toHaveBeenCalledWith(expect.objectContaining({ document_type: '01', series_id: 12, customer_id: 5 }))
    })

    it('avisa y bloquea la boleta de más de S/ 700 sin comprador', async () => {
      const { wrapper } = await mountWithRouter(NewSaleView)
      await addProducts(wrapper, ['Galletas'])
      await wrapper.find('#qty-1').setValue('300') // 897.00
      await choose(wrapper, 'Boleta')

      expect(wrapper.find('[data-test="receipt-limit"]').text()).toContain('S/ 700')
      expect(wrapper.findAll('button').find((b) => b.text() === 'Emitir boleta')!.attributes('disabled')).toBeDefined()
    })

    it('sin emisión SUNAT disponible solo deja el ticket, y dice por qué', async () => {
      vi.mocked(salesDocumentsApi.availability).mockResolvedValue({ ...available, can_issue: false, status_label: 'Pendiente de validación' })
      const { wrapper } = await mountWithRouter(NewSaleView)

      const inputs = wrapper.findAll('[data-test="sale-kind"] input')
      expect(inputs.map((i) => i.attributes('disabled') !== undefined)).toEqual([false, true, true])
      expect(wrapper.find('[data-test="kind-blocked"]').text()).toContain('Pendiente de validación')
    })

    it('con varias series del tipo deja elegir', async () => {
      vi.mocked(salesDocumentsApi.availability).mockResolvedValue({
        ...available, series: [...available.series, { id: 13, document_type: '03', code: 'B002', active: true }],
      })
      vi.mocked(salesDocumentsApi.issue).mockResolvedValue({ id: 33 } as SalesDocument)
      const { wrapper } = await mountWithRouter(NewSaleView)
      await addProducts(wrapper, ['Galletas'])
      await choose(wrapper, 'Boleta')

      await wrapper.find('#sale-series').setValue(13)
      await wrapper.findAll('button').find((b) => b.text() === 'Emitir boleta')!.trigger('click')
      await flushPromises()

      expect(salesDocumentsApi.issue).toHaveBeenCalledWith(expect.objectContaining({ series_id: 13 }))
    })

    it('muestra el error de la API (p. ej. configuración no validada)', async () => {
      vi.mocked(salesDocumentsApi.issue).mockRejectedValue(new ApiError(422, 'x', { sunat: ['La emisión SUNAT no está disponible: Con error.'] }))
      const { wrapper } = await mountWithRouter(NewSaleView)
      await addProducts(wrapper, ['Galletas'])
      await choose(wrapper, 'Boleta')

      await wrapper.findAll('button').find((b) => b.text() === 'Emitir boleta')!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('La emisión SUNAT no está disponible: Con error.')
    })
  })
})
