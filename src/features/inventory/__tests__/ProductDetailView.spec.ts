import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { useSessionStore } from '@/core/auth/session-store'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Lot, Movement, Product } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  inventoryApi: {
    catalogs: vi.fn<AsyncFn>(),
    getProduct: vi.fn<AsyncFn>(),
    lots: vi.fn<AsyncFn>(),
    movements: vi.fn<AsyncFn>(),
    adjust: vi.fn<AsyncFn>(),
    reverse: vi.fn<AsyncFn>(),
  },
}))

const { inventoryApi } = await import('../api')
const { resetInventoryCatalogs } = await import('../composables/useInventoryCatalogs')
const ProductDetailView = (await import('../views/ProductDetailView.vue')).default

const product: Product = {
  id: 7, code: 'YOG-001', name: 'Yogur de fresa', type: 'good', unit: 'NIU', sale_price: '7.50', igv_affectation: '10',
  min_stock: '6.000', tracks_expiry: true, active: true, stock: '25.000', available_stock: '25.000', last_unit_cost: '4.3000', created_at: null,
}
const lot: Lot = {
  id: 3, lot_number: 'L-1', received_at: '2026-09-18', expires_at: '2026-10-08', expired: false, initial_quantity: '10.000',
  remaining_quantity: '10.000', unit_cost: '4.2000', reference: null, created_by: { id: 1, name: 'Ana' }, created_at: null,
}
const movement: Movement = {
  id: 11, type: 'entry', quantity: '10.000', lot: { id: 3, lot_number: 'L-1' }, lot_balance_after: '10.000', product_balance_after: '10.000',
  reason: null, note: null, source: null, reverses_id: null, reversed: false, created_by: { id: 1, name: 'Ana' }, created_at: '2026-09-18T10:00:00Z',
}

async function mountAs(role: 'company_admin' | 'seller', query = '') {
  return mountWithRouter(ProductDetailView, {
    path: `/productos/7${query}`,
    pattern: '/productos/:id',
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Ana', email: 'ana@demo.test' }, platform_admin: false,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null }, role,
      }
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetInventoryCatalogs()
  vi.mocked(inventoryApi.catalogs).mockResolvedValue({
    units: [{ code: 'NIU', label: 'Unidad', allows_decimals: false }],
    igv_affectations: [{ code: '10', label: 'Gravado (IGV)' }],
    adjustment_reasons: [{ code: 'count', label: 'Conteo físico' }, { code: 'error', label: 'Error de registro' }],
  })
  vi.mocked(inventoryApi.getProduct).mockResolvedValue(product)
  vi.mocked(inventoryApi.lots).mockResolvedValue([lot])
  vi.mocked(inventoryApi.movements).mockResolvedValue({
    success: true, data: [movement], meta: { current_page: 1, per_page: 25, total: 1, last_page: 1, from: 1, to: 1 },
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductDetailView', () => {
  it('el administrador ve stock, costo, lotes e historial', async () => {
    const { wrapper } = await mountAs('company_admin')
    await flushPromises()

    expect(wrapper.find('[data-test="product-summary"]').text()).toContain('Último costo')
    expect(wrapper.findAll('[data-test="lot-row"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-test="movement-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Registrar entrada')
  })

  it('el vendedor ve stock y lotes, pero ni costo, ni historial, ni acciones', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue({ ...product, last_unit_cost: undefined })
    const { wrapper } = await mountAs('seller')
    await flushPromises()

    expect(wrapper.find('[data-test="product-summary"]').text()).not.toContain('Último costo')
    expect(wrapper.findAll('[data-test="lot-row"]')).toHaveLength(1)
    expect(inventoryApi.movements).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Registrar entrada')
    expect(wrapper.text()).not.toContain('Ajustar')
  })

  it('muestra el aviso que llega de la edición', async () => {
    const { wrapper } = await mountAs('company_admin', '?aviso=Queda%20desactivado%20con%2025%20en%20stock.')
    await flushPromises()

    expect(wrapper.text()).toContain('Queda desactivado con 25 en stock.')
  })

  it('ajusta un lote restando con motivo y recarga', async () => {
    vi.mocked(inventoryApi.adjust).mockResolvedValue({ ...movement, id: 12, type: 'adjustment' })
    const { wrapper } = await mountAs('company_admin')
    await flushPromises()

    await wrapper.find('[data-test="lot-row"] button').trigger('click')
    await flushPromises()
    const quantity = document.getElementById('adjust-quantity') as HTMLInputElement
    quantity.value = '2'
    quantity.dispatchEvent(new Event('input'))
    document.getElementById('adjust-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(inventoryApi.adjust).toHaveBeenCalledWith(3, { quantity: '-2', reason: 'count' })
    expect(inventoryApi.getProduct).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Ajuste registrado.')
  })

  it('muestra el rechazo de la API al revertir', async () => {
    vi.mocked(inventoryApi.reverse).mockRejectedValue(
      new ApiError(422, 'x', { movement: ['No se puede revertir: el lote ya no tiene el saldo de este movimiento (saldo 3.000).'] }),
    )
    const { wrapper } = await mountAs('company_admin')
    await flushPromises()

    await wrapper.find('[data-test="movement-row"] button').trigger('click')
    await flushPromises()
    document.getElementById('reverse-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(inventoryApi.reverse).toHaveBeenCalledWith(11, { reason: 'error' })
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain('saldo 3.000')
  })
})
