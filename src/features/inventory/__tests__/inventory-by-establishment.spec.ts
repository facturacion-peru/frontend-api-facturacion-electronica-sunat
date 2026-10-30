import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import type { CompanyRole } from '@/core/auth/types'
import { useSessionStore } from '@/core/auth/session-store'
import { useEstablishmentStore } from '@/shared/establishments/store'
import type { Establishment } from '@/shared/establishments/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Lot, Movement, Product } from '../types'

/*
 * Spec 017 · F016–F017: stock, lotes, movimientos, alertas y entradas por
 * local (A-86, A-90), y el traslado entre locales (HU-3).
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  inventoryApi: {
    catalogs: vi.fn<AsyncFn>(),
    listProducts: vi.fn<AsyncFn>(),
    getProduct: vi.fn<AsyncFn>(),
    lots: vi.fn<AsyncFn>(),
    movements: vi.fn<AsyncFn>(),
    alerts: vi.fn<AsyncFn>(),
    registerEntry: vi.fn<AsyncFn>(),
    transfer: vi.fn<AsyncFn>(),
  },
}))
vi.mock('@/shared/establishments/api', () => ({ establishmentsApi: { list: vi.fn<AsyncFn>() } }))
vi.mock('@/core/device', () => ({
  device: () => ({ isNative: false, onConnectionChange: (fn: (online: boolean) => void) => (fn(true), () => {}) }),
}))

const { inventoryApi } = await import('../api')
const { establishmentsApi } = await import('@/shared/establishments/api')
const { resetInventoryCatalogs } = await import('../composables/useInventoryCatalogs')
const ProductsView = (await import('../views/ProductsView.vue')).default
const ProductDetailView = (await import('../views/ProductDetailView.vue')).default
const AlertsView = (await import('../views/AlertsView.vue')).default
const StockEntryView = (await import('../views/StockEntryView.vue')).default

const principal: Establishment = {
  id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123', ubigeo: '150101', district: null, is_main: true, active: true, code_locked: true,
}
const sucursal: Establishment = { ...principal, id: 2, code: '0001', name: 'Sucursal Centro', is_main: false }
const cerrado: Establishment = { ...principal, id: 3, code: '0002', name: 'Cerrado', is_main: false, active: false }
const ref = ({ id, code, name }: Establishment) => ({ id, code, name })

const product: Product = {
  id: 7, code: 'YOG-001', name: 'Yogur de fresa', type: 'good', unit: 'NIU', sale_price: '7.50', igv_affectation: '10',
  min_stock: '6.000', tracks_expiry: false, active: true, stock: '14.000', available_stock: '14.000', last_unit_cost: '4.3000', image: null, created_at: null,
  stock_by_establishment: [
    { establishment_id: 1, stock: '10.000', available_stock: '10.000' },
    { establishment_id: 2, stock: '4.000', available_stock: '4.000' },
    { establishment_id: 3, stock: '0.000', available_stock: '0.000' },
  ],
}
const lot = (id: number, establishment: Establishment): Lot => ({
  id, lot_number: 'L-1', received_at: '2026-09-18', expires_at: null, expired: false, initial_quantity: '10.000',
  remaining_quantity: '4.000', unit_cost: '4.2000', reference: null, created_by: null, created_at: null, establishment: ref(establishment),
})
const movement = (id: number, type: Movement['type'], establishment: Establishment, quantity: string): Movement => ({
  id, type, quantity, lot: { id: 3, lot_number: 'L-1' }, lot_balance_after: '4.000', product_balance_after: '4.000',
  reason: null, note: null, source: null, reverses_id: null, reversed: false, created_by: { id: 1, name: 'Ana' }, created_at: '2026-10-29T10:00:00Z',
  establishment: ref(establishment),
  transfer: type.startsWith('transfer') ? { from: ref(principal), to: ref(sucursal) } : null,
})
const page = <T>(data: T[]) => ({ success: true as const, data, meta: { current_page: 1, per_page: 25, total: data.length, last_page: 1, from: 1, to: data.length } })

function mountAs(view: object, path: string, pattern: string, { role = 'company_admin' as CompanyRole, establishments = [principal, sucursal] } = {}) {
  return mountWithRouter(view, {
    path,
    pattern,
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Ana', email: 'ana@demo.test' }, platform_admin: false, role, establishments,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null, active_establishments_count: establishments.length },
      }
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  resetInventoryCatalogs()
  vi.mocked(inventoryApi.catalogs).mockResolvedValue({ units: [{ code: 'NIU', label: 'Unidad', allows_decimals: false }], igv_affectations: [], adjustment_reasons: [] })
  vi.mocked(establishmentsApi.list).mockResolvedValue([principal, sucursal, cerrado])
  vi.mocked(inventoryApi.getProduct).mockResolvedValue(product)
  vi.mocked(inventoryApi.lots).mockResolvedValue([lot(3, principal), lot(4, sucursal)])
  vi.mocked(inventoryApi.movements).mockResolvedValue(
    page([movement(11, 'transfer_out', principal, '-4.000'), movement(12, 'transfer_in', sucursal, '4.000'), movement(10, 'entry', principal, '10.000')]),
  )
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ficha del producto con varios locales', () => {
  it('muestra el stock de cada local, también de los inactivos', async () => {
    const { wrapper } = await mountAs(ProductDetailView, '/productos/7', '/productos/:id')

    const rows = wrapper.get('[data-test="stock-by-establishment"]').findAll('li')
    expect(rows.map((r) => r.text())).toEqual([
      expect.stringContaining('Principal'), expect.stringContaining('Sucursal Centro'), expect.stringContaining('Cerrado'),
    ])
    expect(rows[1]!.text()).toContain('4')
  })

  it('lotes y movimientos dicen su local; los traslados se leen con el otro local y no se revierten', async () => {
    const { wrapper } = await mountAs(ProductDetailView, '/productos/7', '/productos/:id')

    expect(wrapper.findAll('[data-test="lot-establishment"]').map((p) => p.text())).toEqual(['Principal', 'Sucursal Centro'])
    const movements = wrapper.findAll('[data-test="movement-row"]')
    expect(movements[0]!.text()).toContain('Traslado a Sucursal Centro')
    expect(movements[0]!.text()).toContain('Saldo en Principal')
    expect(movements[1]!.text()).toContain('Traslado desde Principal')
    expect(movements[0]!.text()).not.toContain('Revertir')
    expect(movements[1]!.text()).not.toContain('Revertir')
    expect(movements[2]!.text()).toContain('Revertir')
  })

  it('A-90: el filtro empieza en «Todos» y al cambiarlo pide lotes y movimientos del local', async () => {
    const { wrapper } = await mountAs(ProductDetailView, '/productos/7', '/productos/:id')
    expect(inventoryApi.lots).toHaveBeenLastCalledWith(7, false, null)

    await wrapper.get('#detail-establishment').setValue('2')
    await flushPromises()

    expect(inventoryApi.lots).toHaveBeenLastCalledWith(7, false, 2)
    expect(inventoryApi.movements).toHaveBeenLastCalledWith(7, 1, 2)
  })

  it('A-87: el vendedor empieza en su local', async () => {
    await mountAs(ProductDetailView, '/productos/7', '/productos/:id', { role: 'seller', establishments: [sucursal] })

    expect(inventoryApi.lots).toHaveBeenLastCalledWith(7, false, 2)
  })

  it('RF-010: con un solo local no hay stock por local, filtro ni «Trasladar»', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue({ ...product, stock_by_establishment: [product.stock_by_establishment![0]!] })
    const { wrapper } = await mountAs(ProductDetailView, '/productos/7', '/productos/:id', { establishments: [principal] })

    expect(wrapper.find('[data-test="stock-by-establishment"]').exists()).toBe(false)
    expect(wrapper.find('#detail-establishment').exists()).toBe(false)
    expect(wrapper.find('[data-test="open-transfer"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="lot-establishment"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Saldo en')
    expect(inventoryApi.lots).toHaveBeenLastCalledWith(7, false, null)
  })
})

describe('traslado (HU-3)', () => {
  async function openTransfer() {
    const result = await mountAs(ProductDetailView, '/productos/7', '/productos/:id')
    useEstablishmentStore().choose(sucursal.id)
    await result.wrapper.get('[data-test="open-transfer"]').trigger('click')
    await flushPromises()
    return result
  }

  const options = (id: string) => [...document.querySelectorAll<HTMLOptionElement>(`#${id} option`)].map((o) => o.textContent!.trim())

  it('ofrece los orígenes con stock (el actual primero elegido) y destinos activos distintos del origen', async () => {
    await openTransfer()

    expect(options('transfer-from')).toEqual(['Principal (10 disponible)', 'Sucursal Centro (4 disponible)'])
    expect(document.querySelector<HTMLSelectElement>('#transfer-from')!.value).toBe('2')
    expect(options('transfer-to')).toEqual(['Principal'])
  })

  it('traslada, avisa y recarga la ficha', async () => {
    vi.mocked(inventoryApi.transfer).mockResolvedValue(product)
    const { wrapper } = await openTransfer()

    const from = document.querySelector<HTMLSelectElement>('#transfer-from')!
    from.value = '1'
    from.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(options('transfer-to')).toEqual(['Sucursal Centro'])

    const quantity = document.querySelector<HTMLInputElement>('#transfer-quantity')!
    quantity.value = '4'
    quantity.dispatchEvent(new Event('input'))
    document.getElementById('transfer-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(inventoryApi.transfer).toHaveBeenCalledWith(7, { from_establishment_id: 1, to_establishment_id: 2, quantity: '4' })
    expect(wrapper.text()).toContain('Traslado registrado.')
    expect(document.getElementById('transfer-form')).toBeNull()
    expect(inventoryApi.getProduct).toHaveBeenCalledTimes(2)
  })

  it('HU-3 esc. 3: con stock insuficiente muestra el mensaje en la cantidad y no cierra', async () => {
    vi.mocked(inventoryApi.transfer).mockRejectedValue(
      new ApiError(422, 'Revisa los datos.', { quantity: ['Solo hay 4 disponible de Yogur de fresa.'] }),
    )
    await openTransfer()

    document.getElementById('transfer-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(document.getElementById('transfer-quantity-error')!.textContent).toBe('Solo hay 4 disponible de Yogur de fresa.')
    expect(document.getElementById('transfer-form')).not.toBeNull()
  })

  it('sin stock en ningún local lo dice y no ofrece trasladar', async () => {
    vi.mocked(inventoryApi.getProduct).mockResolvedValue({
      ...product, stock_by_establishment: [{ establishment_id: 1, stock: '0.000', available_stock: '0.000' }],
    })
    await openTransfer()

    expect(document.querySelector('[data-test="no-stock"]')).not.toBeNull()
    expect(document.querySelector('[data-test="confirm-transfer"]')).toBeNull()
  })

  it('el vendedor no puede trasladar', async () => {
    const { wrapper } = await mountAs(ProductDetailView, '/productos/7', '/productos/:id', { role: 'seller' })

    expect(wrapper.find('[data-test="open-transfer"]').exists()).toBe(false)
  })
})

describe('lista, alertas y entradas', () => {
  it('ProductsView filtra el disponible por local', async () => {
    vi.mocked(inventoryApi.listProducts).mockResolvedValue(page([product]))
    const { wrapper } = await mountAs(ProductsView, '/', '/')

    await wrapper.get('#product-establishment').setValue('2')
    await flushPromises()

    expect(inventoryApi.listProducts).toHaveBeenLastCalledWith(expect.objectContaining({ establishment_id: 2, page: 1 }))
  })

  it('AlertsView: un producto puede salir una vez por local, con su nombre', async () => {
    vi.mocked(inventoryApi.alerts).mockResolvedValue({
      low_stock: [
        { id: 1, code: 'LEC-001', name: 'Leche', available_stock: '2.000', min_stock: '6.000', establishment: ref(principal) },
        { id: 1, code: 'LEC-001', name: 'Leche', available_stock: '1.000', min_stock: '6.000', establishment: ref(sucursal) },
      ],
      expiring: [],
      expired: [],
    })
    const { wrapper } = await mountAs(AlertsView, '/', '/')

    const rows = wrapper.findAll('[data-test="low-stock-row"]')
    expect(rows.map((r) => r.text())).toEqual([expect.stringContaining('Principal'), expect.stringContaining('Sucursal Centro')])

    await wrapper.get('#alerts-establishment').setValue('2')
    await flushPromises()
    expect(inventoryApi.alerts).toHaveBeenLastCalledWith(2)
  })

  it('HU-3 esc. 1: la entrada va al local elegido, por defecto el actual', async () => {
    vi.mocked(inventoryApi.registerEntry).mockResolvedValue({ lot: lot(5, sucursal), productStock: '8.000' })
    localStorage.setItem('sunat.establishment.1.1', JSON.stringify({ v: 1, id: sucursal.id }))
    const { wrapper } = await mountAs(StockEntryView, '/productos/7/entrada', '/productos/:id/entrada')

    expect((wrapper.get('#entry-establishment').element as HTMLSelectElement).value).toBe('2')
    await wrapper.get('#quantity').setValue('4')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(inventoryApi.registerEntry).toHaveBeenCalledWith(7, { quantity: '4', establishment_id: 2 })
  })

  it('RF-010: con un solo local la entrada no pide local y manda el único', async () => {
    vi.mocked(inventoryApi.registerEntry).mockResolvedValue({ lot: lot(5, principal), productStock: '8.000' })
    const { wrapper } = await mountAs(StockEntryView, '/productos/7/entrada', '/productos/:id/entrada', { establishments: [principal] })

    expect(wrapper.find('#entry-establishment').exists()).toBe(false)
    await wrapper.get('#quantity').setValue('4')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(inventoryApi.registerEntry).toHaveBeenCalledWith(7, { quantity: '4', establishment_id: 1 })
  })
})
