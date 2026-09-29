import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SellableProduct } from '../api'
import type { Ticket } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ salesApi: { searchProducts: vi.fn<AsyncFn>(), issue: vi.fn<AsyncFn>() } }))

const { salesApi } = await import('../api')
const NewSaleView = (await import('../views/NewSaleView.vue')).default

const galletas: SellableProduct = { id: 1, code: 'GAL-1', name: 'Galletas', type: 'good', unit: 'NIU', sale_price: '2.99', available_stock: '10.000' }
const azucar: SellableProduct = { id: 2, code: 'AZU-1', name: 'Azúcar', type: 'good', unit: 'KGM', sale_price: '4.20', available_stock: '5.000' }
const agotado: SellableProduct = { id: 3, code: 'AGO-1', name: 'Agotado', type: 'good', unit: 'NIU', sale_price: '1.00', available_stock: '0.000' }

const ticket = { id: 9, display_number: 'T-000009' } as Ticket

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(salesApi.searchProducts).mockResolvedValue([galletas, azucar, agotado])
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
})
