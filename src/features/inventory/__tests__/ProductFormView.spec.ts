import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Product } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  inventoryApi: { catalogs: vi.fn<AsyncFn>(), getProduct: vi.fn<AsyncFn>(), createProduct: vi.fn<AsyncFn>(), updateProduct: vi.fn<AsyncFn>() },
}))

const { inventoryApi } = await import('../api')
const { resetInventoryCatalogs } = await import('../composables/useInventoryCatalogs')
const ProductFormView = (await import('../views/ProductFormView.vue')).default

const existing: Product = {
  id: 7, code: 'AZU-001', name: 'Azúcar rubia', type: 'good', unit: 'KGM', sale_price: '4.20', igv_affectation: '20',
  min_stock: '10.000', tracks_expiry: false, active: true, stock: '50.500', available_stock: '50.500', created_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  resetInventoryCatalogs()
  vi.mocked(inventoryApi.catalogs).mockResolvedValue({
    units: [
      { code: 'NIU', label: 'Unidad', allows_decimals: false },
      { code: 'KGM', label: 'Kilogramo', allows_decimals: true },
      { code: 'ZZ', label: 'Servicio', allows_decimals: false },
    ],
    igv_affectations: [{ code: '10', label: 'Gravado (IGV)' }, { code: '20', label: 'Exonerado' }],
    adjustment_reasons: [],
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductFormView', () => {
  it('crea un producto y va a su ficha', async () => {
    vi.mocked(inventoryApi.createProduct).mockResolvedValue({ ...existing, id: 9 })
    const { wrapper, router } = await mountWithRouter(ProductFormView)
    const push = vi.spyOn(router, 'push')

    await wrapper.find('#code').setValue('ARZ-001')
    await wrapper.find('#name').setValue('Arroz')
    await wrapper.find('#sale_price').setValue('25.90')
    await wrapper.find('#min_stock').setValue('5')
    await wrapper.find('#tracks_expiry').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(inventoryApi.createProduct).toHaveBeenCalledWith({
      code: 'ARZ-001', name: 'Arroz', type: 'good', unit: 'NIU', sale_price: '25.90', igv_affectation: '10', min_stock: '5', tracks_expiry: true,
    })
    expect(push).toHaveBeenCalledWith({ name: 'product-detail', params: { id: 9 }, query: { guardado: '1' } })
  })

  it('un servicio oculta stock mínimo y vencimiento, y usa la unidad servicio', async () => {
    const { wrapper } = await mountWithRouter(ProductFormView)

    await wrapper.find('input[value="service"]').setValue(true)

    expect(wrapper.find('#min_stock').exists()).toBe(false)
    expect(wrapper.find('#tracks_expiry').exists()).toBe(false)
    expect((wrapper.find('#unit').element as HTMLSelectElement).value).toBe('ZZ')
  })

  it('el teclado del stock mínimo depende de si la unidad admite decimales', async () => {
    const { wrapper } = await mountWithRouter(ProductFormView)

    expect(wrapper.find('#min_stock').attributes('inputmode')).toBe('numeric')
    await wrapper.find('#unit').setValue('KGM')
    expect(wrapper.find('#min_stock').attributes('inputmode')).toBe('decimal')
  })

  it('edita un producto y muestra los errores por campo', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue(existing)
    vi.mocked(inventoryApi.updateProduct).mockRejectedValue(new ApiError(422, 'x', { code: ['Ya existe un producto con este código.'] }))
    const { wrapper } = await mountWithRouter(ProductFormView, { path: '/productos/7/editar', pattern: '/productos/:id/editar' })

    expect((wrapper.find('#name').element as HTMLInputElement).value).toBe('Azúcar rubia')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(inventoryApi.updateProduct).toHaveBeenCalledWith(7, expect.objectContaining({ code: 'AZU-001', active: true }))
    expect(wrapper.find('#code-error').text()).toBe('Ya existe un producto con este código.')
  })

  it('al desactivar con stock lleva el aviso de la API a la ficha', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue(existing)
    vi.mocked(inventoryApi.updateProduct).mockResolvedValue({ product: { ...existing, active: false }, warning: 'El producto queda desactivado con 50.500 en stock.' })
    const { wrapper, router } = await mountWithRouter(ProductFormView, { path: '/productos/7/editar', pattern: '/productos/:id/editar' })
    const push = vi.spyOn(router, 'push')

    await wrapper.find('#active').setValue(false)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'product-detail', params: { id: 7 }, query: { aviso: 'El producto queda desactivado con 50.500 en stock.' } })
  })
})
