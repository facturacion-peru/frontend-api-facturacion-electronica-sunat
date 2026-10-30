import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { principal, sessionWith } from '@/shared/testing/establishments'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'

/*
 * Spec 017 · F020 (RF-010, A-91): con un solo local activo, ninguna pantalla
 * muestra selector, filtro ni nombre de local, y las lecturas no mandan
 * `establishment_id`. Las demás pantallas lo prueban en su propio archivo
 * (barra lateral, «Vender», inicio, listas de ventas, ficha, entrada,
 * «Series», «Usuarios», exportar e importar).
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('@/features/inventory/api', () => ({
  inventoryApi: { catalogs: vi.fn<AsyncFn>(), listProducts: vi.fn<AsyncFn>(), alerts: vi.fn<AsyncFn>() },
}))
vi.mock('@/features/sales/api', () => ({ salesDocumentsApi: { list: vi.fn<AsyncFn>() } }))
vi.mock('@/shared/establishments/api', () => ({ establishmentsApi: { list: vi.fn<AsyncFn>() } }))

const { inventoryApi } = await import('@/features/inventory/api')
const { salesDocumentsApi } = await import('@/features/sales/api')
const { establishmentsApi } = await import('@/shared/establishments/api')
const { resetInventoryCatalogs } = await import('@/features/inventory/composables/useInventoryCatalogs')

const meta = { current_page: 1, per_page: 25, total: 0, last_page: 1, from: null, to: null }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  resetInventoryCatalogs()
  vi.mocked(inventoryApi.catalogs).mockResolvedValue({ units: [], igv_affectations: [], adjustment_reasons: [] })
  vi.mocked(inventoryApi.listProducts).mockResolvedValue({ success: true, data: [], meta })
  vi.mocked(inventoryApi.alerts).mockResolvedValue({ low_stock: [], expiring: [], expired: [] })
  vi.mocked(salesDocumentsApi.list).mockResolvedValue({ success: true, data: [], meta, counts: { pending: 0, rejected: 0 } })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('RF-010 con un solo local', () => {
  it.each([
    ['Productos', () => import('@/features/inventory/views/ProductsView.vue')],
    ['Alertas', () => import('@/features/inventory/views/AlertsView.vue')],
    ['Comprobantes', () => import('@/features/sales/views/SalesDocumentsView.vue')],
  ])('%s no muestra el filtro de local ni lo pide', async (_, load) => {
    const { wrapper } = await mountWithRouter((await load()).default, { beforeMount: () => sessionWith([principal]) })

    expect(wrapper.find('[data-test="establishment-filter"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Todos los locales')
    expect(establishmentsApi.list).not.toHaveBeenCalled()
  })

  it('las lecturas no mandan establishment_id', async () => {
    for (const load of [
      () => import('@/features/inventory/views/ProductsView.vue'),
      () => import('@/features/inventory/views/AlertsView.vue'),
      () => import('@/features/sales/views/SalesDocumentsView.vue'),
    ]) {
      await mountWithRouter((await load()).default, { beforeMount: () => sessionWith([principal]) })
    }

    expect(inventoryApi.listProducts).toHaveBeenCalledWith(expect.objectContaining({ establishment_id: null }))
    expect(inventoryApi.alerts).toHaveBeenCalledWith(null)
    expect(salesDocumentsApi.list).toHaveBeenCalledWith(expect.objectContaining({ establishment_id: null }))
  })
})
