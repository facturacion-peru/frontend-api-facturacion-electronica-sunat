import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { useSessionStore } from '@/core/auth/session-store'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Product } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  inventoryApi: { catalogs: vi.fn<AsyncFn>(), listProducts: vi.fn<AsyncFn>() },
}))

const { inventoryApi } = await import('../api')
const { resetInventoryCatalogs } = await import('../composables/useInventoryCatalogs')
const ProductsView = (await import('../views/ProductsView.vue')).default

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 1, code: 'ARZ-001', name: 'Arroz extra 5 kg', type: 'good', unit: 'NIU', sale_price: '25.90', igv_affectation: '10',
  min_stock: '5.000', tracks_expiry: false, active: true, stock: '36.000', available_stock: '36.000', created_at: null, ...overrides,
})

const page = (data: Product[]) => ({ success: true as const, data, meta: { current_page: 1, per_page: 20, total: data.length, last_page: 1, from: 1, to: data.length } })

async function mountAs(role: 'company_admin' | 'seller') {
  const mounted = await mountWithRouter(ProductsView)
  const session = useSessionStore()
  session.session = {
    user: { id: 1, name: 'Ana', email: 'ana@demo.test' }, platform_admin: false,
    company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null }, role,
  }
  await flushPromises()

  return mounted
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  resetInventoryCatalogs()
  vi.mocked(inventoryApi.catalogs).mockResolvedValue({ units: [{ code: 'NIU', label: 'Unidad', allows_decimals: false }], igv_affectations: [], adjustment_reasons: [] })
  vi.mocked(inventoryApi.listProducts).mockResolvedValue(page([product(), product({ id: 2, code: 'LEC-01', name: 'Leche', available_stock: '3.000', min_stock: '12.000' })]))
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('ProductsView', () => {
  it('lista productos con precio, disponible y alerta de stock bajo', async () => {
    const { wrapper } = await mountAs('seller')

    const rows = wrapper.findAll('[data-test="product-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Arroz extra 5 kg')
    expect(rows[0]!.text()).toContain('Unidad')
    expect(rows[0]!.text()).toMatch(/25\.90/)
    expect(rows[1]!.text()).toContain('Stock bajo')
  })

  it('busca con espera entre teclas y vuelve a la primera página', async () => {
    const { wrapper } = await mountAs('seller')

    await wrapper.find('#product-search').setValue('lec')
    await wrapper.find('#product-search').trigger('input')
    vi.advanceTimersByTime(350)
    await flushPromises()

    expect(inventoryApi.listProducts).toHaveBeenLastCalledWith({ search: 'lec', type: '', status: 'active', page: 1 })
  })

  it('el vendedor no ve el alta ni el filtro de desactivados', async () => {
    const { wrapper } = await mountAs('seller')

    expect(wrapper.text()).not.toContain('Nuevo producto')
    expect(wrapper.find('#product-status').exists()).toBe(false)
  })

  it('el administrador ve el alta y puede listar desactivados', async () => {
    const { wrapper } = await mountAs('company_admin')

    expect(wrapper.text()).toContain('Nuevo producto')
    await wrapper.find('#product-status').setValue('inactive')
    await flushPromises()

    expect(inventoryApi.listProducts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'inactive', page: 1 }))
  })
})
