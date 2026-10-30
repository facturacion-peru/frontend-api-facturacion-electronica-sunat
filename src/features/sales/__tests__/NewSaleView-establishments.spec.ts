import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import type { PaginatedResponse } from '@/core/api/types'
import type { CompanyRole } from '@/core/auth/types'
import { useSessionStore } from '@/core/auth/session-store'
import { useEstablishmentStore } from '@/shared/establishments/store'
import type { Establishment } from '@/shared/establishments/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { CatalogProduct } from '../api'
import type { IssuingAvailability, Ticket } from '../types'

/*
 * Spec 017 · F009: «Vender» en el local actual (HU-2, esc. 1 a 5, y casos
 * límite del local desactivado y del vendedor sin locales).
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  salesApi: { listProducts: vi.fn<AsyncFn>(), getProduct: vi.fn<AsyncFn>(), issue: vi.fn<AsyncFn>() },
  salesDocumentsApi: { availability: vi.fn<AsyncFn>(), issue: vi.fn<AsyncFn>(), download: vi.fn<AsyncFn>() },
  customersApi: { search: vi.fn<AsyncFn>(), create: vi.fn<AsyncFn>() },
}))
vi.mock('@/shared/establishments/api', () => ({ establishmentsApi: { list: vi.fn<AsyncFn>() } }))

const { salesApi, salesDocumentsApi } = await import('../api')
const { establishmentsApi } = await import('@/shared/establishments/api')
const NewSaleView = (await import('../views/NewSaleView.vue')).default

const principal: Establishment = {
  id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123', ubigeo: '150101', district: null, is_main: true, active: true, code_locked: true,
}
const sucursal: Establishment = { ...principal, id: 2, code: '0001', name: 'Sucursal Centro', is_main: false }

const galletas: CatalogProduct = { id: 1, code: 'GAL-1', name: 'Galletas', type: 'good', unit: 'NIU', sale_price: '2.99', available_stock: '10.000', image: null }
const page = (data: CatalogProduct[]): PaginatedResponse<CatalogProduct> => ({
  success: true, data, meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length, from: 1, to: data.length },
})
const seriesOf = (id: number): IssuingAvailability => ({
  can_issue: true,
  status_label: 'Validada',
  series: [{ id: 10 + id, document_type: '03', code: `B00${id}`, active: true, establishment_id: id }],
})
const ticket = { id: 9, display_number: 'T-000009', establishment: { id: 2, code: '0001', name: 'Sucursal Centro' } } as Ticket

function mountSale({ establishments = [principal, sucursal], activeCount = 2, role = 'seller' as CompanyRole, chosen = null as number | null } = {}) {
  if (chosen) localStorage.setItem('sunat.establishment.1.1', JSON.stringify({ v: 1, id: chosen }))
  vi.mocked(establishmentsApi.list).mockResolvedValue(establishments)
  return mountWithRouter(NewSaleView, {
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Luis', email: 'luis@demo.test' }, platform_admin: false, role, establishments,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null, active_establishments_count: activeCount },
      }
    },
  })
}

const card = (wrapper: VueWrapper, name: string) => wrapper.findAll('[data-test="catalog"] button').find((b) => b.text().includes(name))!
const chargeButton = (wrapper: VueWrapper) => wrapper.findAll('button').find((b) => b.text() === 'Cobrar')!
const dialogText = () => document.querySelector('[role="dialog"]')?.textContent ?? null

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('min-width'), media: query, addEventListener: () => {}, removeEventListener: () => {} }))
  vi.mocked(salesApi.listProducts).mockResolvedValue(page([galletas]))
  vi.mocked(salesApi.getProduct).mockImplementation(async () => ({ ...galletas, active: true }))
  vi.mocked(salesDocumentsApi.availability).mockImplementation(async (id) => seriesOf((id as number | null) ?? 1))
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('Vender con varios locales', () => {
  it('HU-2 esc. 2: sin local elegido pide elegirlo y no muestra catálogo ni carrito', async () => {
    const { wrapper } = await mountSale()

    expect(establishmentsApi.list).toHaveBeenCalled()
    expect(wrapper.find('[data-test="choose-establishment"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="catalog"]').exists()).toBe(false)
    expect(salesApi.listProducts).not.toHaveBeenCalled()
    expect(dialogText()).toContain('¿En qué local trabajas?')

    document.querySelector<HTMLButtonElement>('[data-test="pick-establishment-2"]')!.click()
    await flushPromises()

    expect(salesApi.listProducts).toHaveBeenLastCalledWith({ search: '', page: 1, establishmentId: 2 })
    expect(salesDocumentsApi.availability).toHaveBeenLastCalledWith(2)
    expect(wrapper.get('[data-test="sale-establishment"]').text()).toContain('Sucursal Centro')
  })

  it('HU-2 esc. 1: el vendedor con un solo local ve su nombre y vende allí sin elegir', async () => {
    vi.mocked(salesApi.issue).mockResolvedValue(ticket)
    const { wrapper } = await mountSale({ establishments: [sucursal] })

    expect(wrapper.get('[data-test="sale-establishment"]').text()).toContain('Sucursal Centro')
    expect(dialogText()).toBeNull()
    expect(salesDocumentsApi.availability).toHaveBeenCalledWith(2)

    await card(wrapper, 'Galletas').trigger('click')
    await chargeButton(wrapper).trigger('click')
    await flushPromises()

    expect(salesApi.issue).toHaveBeenCalledWith(expect.objectContaining({ establishment_id: 2 }))
  })

  it('HU-2 esc. 2: cambiar de local guarda la venta y la recupera al volver; cada una se cobra en su local', async () => {
    vi.mocked(salesApi.issue).mockResolvedValue(ticket)
    const { wrapper } = await mountSale({ chosen: 1 })
    await card(wrapper, 'Galletas').trigger('click')
    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(1)

    useEstablishmentStore().choose(2)
    await flushPromises()
    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(0)
    expect(salesApi.listProducts).toHaveBeenLastCalledWith(expect.objectContaining({ establishmentId: 2 }))

    useEstablishmentStore().choose(1)
    await flushPromises()
    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(1)
    expect(salesApi.getProduct).toHaveBeenLastCalledWith(1, 1)

    await chargeButton(wrapper).trigger('click')
    await flushPromises()
    expect(salesApi.issue).toHaveBeenCalledWith(expect.objectContaining({ establishment_id: 1 }))
  })

  it('HU-2 esc. 1: solo ofrece las series del local', async () => {
    const { wrapper } = await mountSale({ chosen: 2 })

    await card(wrapper, 'Galletas').trigger('click')
    await wrapper.findAll('[data-test="sale-kind"] label').find((l) => l.text() === 'Boleta')!.find('input').setValue(true)
    await flushPromises()

    expect(wrapper.text()).toContain('Emitir boleta · B002')
    expect(wrapper.text()).not.toContain('B001')
  })

  it('HU-2 esc. 5: si el local se desactivó al cobrar, pide elegir otro y la venta sigue guardada en su local', async () => {
    vi.mocked(salesApi.issue).mockRejectedValue(new ApiError(422, 'Revisa los datos.', { establishment_id: ['No puedes trabajar en ese local.'] }))
    const { wrapper } = await mountSale({ chosen: 2 })
    await card(wrapper, 'Galletas').trigger('click')

    vi.mocked(establishmentsApi.list).mockResolvedValue([principal, { ...sucursal, id: 3, code: '0002', name: 'Norte' }])
    await chargeButton(wrapper).trigger('click')
    await flushPromises()

    expect(useEstablishmentStore().current).toBeNull()
    expect(wrapper.find('[data-test="choose-establishment"]').exists()).toBe(true)
    expect(dialogText()).toContain('¿En qué local trabajas?')
    expect(localStorage.getItem('sunat.sale-draft.1.1.2')).toContain('Galletas')
  })

  it('caso límite: el vendedor sin locales activos ve el aviso y no carga el catálogo', async () => {
    const { wrapper } = await mountSale({ establishments: [] })

    expect(wrapper.get('[data-test="no-establishment"]').text()).toContain('No tienes un local asignado. Pide al administrador que te asigne uno.')
    expect(salesApi.listProducts).not.toHaveBeenCalled()
    expect(salesDocumentsApi.availability).not.toHaveBeenCalled()
  })

  it('RF-010: con un solo local no muestra el local ni lo manda al leer; al cobrar manda el único', async () => {
    vi.mocked(salesApi.issue).mockResolvedValue(ticket)
    const { wrapper } = await mountSale({ establishments: [principal], activeCount: 1 })

    expect(wrapper.get('[data-test="sale-establishment"]').text()).toBe('')
    expect(salesApi.listProducts).toHaveBeenCalledWith({ search: '', page: 1 })
    expect(salesDocumentsApi.availability).toHaveBeenCalledWith(null)

    await card(wrapper, 'Galletas').trigger('click')
    await chargeButton(wrapper).trigger('click')
    await flushPromises()
    expect(salesApi.issue).toHaveBeenCalledWith(expect.objectContaining({ establishment_id: 1 }))
  })
})
