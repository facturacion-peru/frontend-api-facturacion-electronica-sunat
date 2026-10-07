import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import { dataTransferRoutes } from '../routes'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  dataTransferApi: {
    exportSales: vi.fn<AsyncFn>(), exportProducts: vi.fn<AsyncFn>(), exportCustomers: vi.fn<AsyncFn>(),
    template: vi.fn<AsyncFn>(), preview: vi.fn<AsyncFn>(), confirm: vi.fn<AsyncFn>(),
  },
}))

const { dataTransferApi } = await import('../api')
const DataTransferView = (await import('../views/DataTransferView.vue')).default

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(dataTransferApi.exportProducts).mockResolvedValue(undefined)
  vi.mocked(dataTransferApi.exportCustomers).mockResolvedValue(undefined)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DataTransferView', () => {
  it('la ruta «datos» es solo del administrador de empresa (A-73)', () => {
    expect(dataTransferRoutes).toHaveLength(1)
    expect(dataTransferRoutes[0]).toMatchObject({ path: 'datos', name: 'data-transfer', meta: { roles: ['company_admin'] } })
  })

  it('reúne la exportación de ventas, la del catálogo y clientes, y la importación', async () => {
    const { wrapper } = await mountWithRouter(DataTransferView)

    expect(wrapper.findAll('h2').map((h) => h.text())).toEqual(['Exportar ventas', 'Exportar catálogo y clientes', 'Importar productos o clientes'])
    expect(wrapper.find('#sales-export-from').exists()).toBe(true)
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
  })

  it('exporta el catálogo y los clientes completos en el formato elegido', async () => {
    const { wrapper } = await mountWithRouter(DataTransferView)

    await wrapper.find('#export-all-format').setValue('csv')
    await wrapper.findAll('button').find((b) => b.text() === 'Productos y stock')!.trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Clientes')!.trigger('click')
    await flushPromises()

    expect(dataTransferApi.exportProducts).toHaveBeenCalledWith('csv')
    expect(dataTransferApi.exportCustomers).toHaveBeenCalledWith('csv')
  })

  it('muestra el error de una exportación', async () => {
    vi.mocked(dataTransferApi.exportCustomers).mockRejectedValue(new ApiError(403, 'No tienes permiso para realizar esta acción.'))
    const { wrapper } = await mountWithRouter(DataTransferView)

    await wrapper.findAll('button').find((b) => b.text() === 'Clientes')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('No tienes permiso')
  })
})
