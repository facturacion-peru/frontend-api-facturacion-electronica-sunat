import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Series } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  seriesApi: { list: vi.fn<AsyncFn>(), create: vi.fn<AsyncFn>(), setActive: vi.fn<AsyncFn>() },
}))

const { seriesApi } = await import('../api')
const SeriesView = (await import('../views/SeriesView.vue')).default

const b001: Series = {
  id: 1, document_type: '03', document_type_label: 'Boleta', code: 'B001', last_number: 150, next_number: 151, active: true, establishment_code: '0000',
}
const f001: Series = { ...b001, id: 2, document_type: '01', document_type_label: 'Factura', code: 'F001', last_number: 0, next_number: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(seriesApi.list).mockResolvedValue([f001, b001])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SeriesView', () => {
  it('agrupa por tipo con último y siguiente número', async () => {
    const { wrapper } = await mountWithRouter(SeriesView)

    expect(wrapper.find('[data-test="group-01"]').text()).toContain('F001')
    const boleta = wrapper.find('[data-test="series-B001"]').text()
    expect(boleta).toContain('Último número: 150')
    expect(boleta).toContain('Siguiente: 151')
  })

  it('crea una serie con el último número usado', async () => {
    vi.mocked(seriesApi.create).mockResolvedValue({ ...b001, id: 3, code: 'B002' })
    const { wrapper } = await mountWithRouter(SeriesView)

    await wrapper.find('#code').setValue('b002')
    await wrapper.find('#last_number').setValue('40')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(seriesApi.create).toHaveBeenCalledWith({ document_type: '03', code: 'B002', last_number: 40 })
    expect(wrapper.text()).toContain('Serie B002 creada.')
  })

  it('al elegir factura propone la letra F', async () => {
    const { wrapper } = await mountWithRouter(SeriesView)

    await wrapper.find('#document_type').setValue('01')

    expect((wrapper.find('#code').element as HTMLInputElement).value).toBe('F001')
  })

  it('007 propone BC01 al elegir nota de crédito y la agrupa aparte', async () => {
    vi.mocked(seriesApi.list).mockResolvedValue([f001, b001, { ...b001, id: 9, document_type: '07', document_type_label: 'Nota de crédito', code: 'BC01', last_number: 0, next_number: 1 }])
    const { wrapper } = await mountWithRouter(SeriesView)

    await wrapper.find('#document_type').setValue('07')

    expect((wrapper.find('#code').element as HTMLInputElement).value).toBe('BC01')
    expect(wrapper.find('[data-test="group-07"]').text()).toContain('Notas de crédito')
    expect(wrapper.find('[data-test="group-07"]').text()).toContain('BC01')
  })

  it('muestra el error de formato de la serie', async () => {
    vi.mocked(seriesApi.create).mockRejectedValue(new ApiError(422, 'x', { code: ['La serie de boleta debe ser B y tres letras o números.'] }))
    const { wrapper } = await mountWithRouter(SeriesView)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#code-error').text()).toContain('debe ser B')
  })

  it('muestra el error del Nuevo RUS', async () => {
    vi.mocked(seriesApi.create).mockRejectedValue(new ApiError(422, 'x', { document_type: ['Las empresas del Nuevo RUS no emiten facturas.'] }))
    const { wrapper } = await mountWithRouter(SeriesView)

    await wrapper.find('#document_type').setValue('01')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#document_type-error').text()).toBe('Las empresas del Nuevo RUS no emiten facturas.')
  })

  it('desactiva una serie', async () => {
    vi.mocked(seriesApi.setActive).mockResolvedValue({ ...b001, active: false })
    const { wrapper } = await mountWithRouter(SeriesView)

    await wrapper.find('[data-test="series-B001"] button').trigger('click')
    await flushPromises()

    expect(seriesApi.setActive).toHaveBeenCalledWith(1, false)
    expect(wrapper.text()).toContain('Serie B001 desactivada.')
  })

  it('no ofrece editar el correlativo de una serie existente', async () => {
    const { wrapper } = await mountWithRouter(SeriesView)

    expect(wrapper.find('[data-test="series-B001"] input').exists()).toBe(false)
  })
})
