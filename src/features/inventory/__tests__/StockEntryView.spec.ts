import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Product } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  inventoryApi: { catalogs: vi.fn<AsyncFn>(), getProduct: vi.fn<AsyncFn>(), registerEntry: vi.fn<AsyncFn>() },
}))

const { inventoryApi } = await import('../api')
const { resetInventoryCatalogs } = await import('../composables/useInventoryCatalogs')
const StockEntryView = (await import('../views/StockEntryView.vue')).default

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 7, code: 'ARZ-001', name: 'Arroz', type: 'good', unit: 'NIU', sale_price: '25.90', igv_affectation: '10',
  min_stock: null, tracks_expiry: false, active: true, stock: '36.000', available_stock: '36.000', created_at: null, ...overrides,
})

async function mountEntry() {
  return mountWithRouter(StockEntryView, { path: '/productos/7/entrada', pattern: '/productos/:id/entrada' })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetInventoryCatalogs()
  vi.mocked(inventoryApi.catalogs).mockResolvedValue({
    units: [{ code: 'NIU', label: 'Unidad', allows_decimals: false }, { code: 'KGM', label: 'Kilogramo', allows_decimals: true }],
    igv_affectations: [],
    adjustment_reasons: [],
  })
  vi.mocked(inventoryApi.registerEntry).mockResolvedValue({
    lot: {
      id: 1, lot_number: 'L-1', received_at: '2026-09-28', expires_at: null, expired: false, initial_quantity: '4.000',
      remaining_quantity: '4.000', reference: null, created_by: null, created_at: null,
    },
    productStock: '40.000',
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('StockEntryView', () => {
  it('registra una entrada con solo la cantidad y vuelve a la ficha', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue(product())
    const { wrapper, router } = await mountEntry()
    const push = vi.spyOn(router, 'push')

    expect(wrapper.find('#expires_at').exists()).toBe(false)
    expect(wrapper.find('#entry-more').isVisible()).toBe(false)

    await wrapper.find('#quantity').setValue('4')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(inventoryApi.registerEntry).toHaveBeenCalledWith(7, { quantity: '4' })
    expect(push).toHaveBeenCalledWith({ name: 'product-detail', params: { id: 7 }, query: { entrada: '1' } })
  })

  it('pide vencimiento si el producto lo controla', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue(product({ tracks_expiry: true }))
    const { wrapper } = await mountEntry()

    await wrapper.find('#quantity').setValue('10')
    await wrapper.find('#expires_at').setValue('2027-01-31')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(inventoryApi.registerEntry).toHaveBeenCalledWith(7, { quantity: '10', expires_at: '2027-01-31' })
  })

  it('envía los datos opcionales y usa teclado decimal en productos por peso', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue(product({ unit: 'KGM' }))
    const { wrapper } = await mountEntry()

    expect(wrapper.find('#quantity').attributes('inputmode')).toBe('decimal')
    await wrapper.find('[aria-controls="entry-more"]').trigger('click')
    await wrapper.find('#quantity').setValue('12.750')
    await wrapper.find('#lot_number').setValue('F-123')
    await wrapper.find('#unit_cost').setValue('3.10')
    await wrapper.find('#reference').setValue('Factura F001-9')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(inventoryApi.registerEntry).toHaveBeenCalledWith(7, {
      quantity: '12.750', lot_number: 'F-123', unit_cost: '3.10', reference: 'Factura F001-9',
    })
  })

  it('despliega los datos opcionales si el error está en uno de ellos', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue(product())
    vi.mocked(inventoryApi.registerEntry).mockRejectedValue(new ApiError(422, 'x', { lot_number: ['Este producto ya tiene un lote con ese número.'] }))
    const { wrapper } = await mountEntry()

    await wrapper.find('#quantity').setValue('1')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#entry-more').isVisible()).toBe(true)
    expect(wrapper.find('#lot_number-error').text()).toBe('Este producto ya tiene un lote con ese número.')
  })
})
