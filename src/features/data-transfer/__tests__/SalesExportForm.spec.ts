import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { ApiError } from '@/core/api/errors'
import { principal, sessionWith, sucursal } from '@/shared/testing/establishments'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ dataTransferApi: { exportSales: vi.fn<AsyncFn>() } }))
vi.mock('@/shared/establishments/api', () => ({ establishmentsApi: { list: async () => [principal, sucursal] } }))

const { dataTransferApi } = await import('../api')
const SalesExportForm = (await import('../components/SalesExportForm.vue')).default

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  // 7 de octubre de 2026, 22:30 en Lima (ya es el 8 en UTC).
  vi.useFakeTimers({ now: new Date('2026-10-08T03:30:00Z'), shouldAdvanceTime: true })
  vi.mocked(dataTransferApi.exportSales).mockResolvedValue(undefined)
})

afterEach(() => vi.useRealTimers())

const value = (wrapper: ReturnType<typeof mount>, selector: string) => (wrapper.find(selector).element as HTMLInputElement).value

describe('SalesExportForm', () => {
  it('propone el mes en curso de Lima, todos los tipos y estados, en Excel', () => {
    const wrapper = mount(SalesExportForm)

    expect(value(wrapper, '#sales-export-from')).toBe('2026-10-01')
    expect(value(wrapper, '#sales-export-to')).toBe('2026-10-07')
    expect(wrapper.findAll('input[type="checkbox"]:checked')).toHaveLength(4)
    expect(value(wrapper, '#sales-export-format')).toBe('xlsx')
  })

  it('descarga con los filtros elegidos', async () => {
    const wrapper = mount(SalesExportForm)
    await wrapper.find('#sales-export-from').setValue('2026-09-01')
    await wrapper.find('#sales-export-to').setValue('2026-09-30')
    await wrapper.find('input[value="ticket"]').setValue(false)
    await wrapper.find('#sales-export-status').setValue('counted')
    await wrapper.find('#sales-export-format').setValue('csv')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(dataTransferApi.exportSales).toHaveBeenCalledWith({
      from: '2026-09-01',
      to: '2026-09-30',
      types: ['receipt', 'invoice', 'credit_note'],
      statuses: ['issued', 'pending', 'sent', 'accepted', 'observed'],
      format: 'csv',
      establishment_id: null,
    })
    expect(wrapper.text()).toContain('Descarga lista')
  })

  it('valida el rango antes de pedirlo: invertido, de más de 12 meses o sin tipos', async () => {
    const wrapper = mount(SalesExportForm)

    await wrapper.find('#sales-export-from').setValue('2026-10-07')
    await wrapper.find('#sales-export-to').setValue('2026-10-01')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('La fecha final no puede ser anterior a la inicial.')

    await wrapper.find('#sales-export-from').setValue('2025-10-01')
    await wrapper.find('#sales-export-to').setValue('2026-10-01')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('El rango no puede superar los 12 meses.')

    await wrapper.find('#sales-export-from').setValue('2025-10-01')
    await wrapper.find('#sales-export-to').setValue('2026-09-30')
    for (const box of wrapper.findAll('input[type="checkbox"]')) await box.setValue(false)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Elige al menos un tipo de documento.')

    expect(dataTransferApi.exportSales).not.toHaveBeenCalled()
  })

  it('muestra el error de la API', async () => {
    vi.mocked(dataTransferApi.exportSales).mockRejectedValue(new ApiError(429, 'Demasiados intentos. Inténtalo más tarde.'))
    const wrapper = mount(SalesExportForm)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Demasiados intentos')
  })

  it('017 HU-4 esc. 3: con varios locales se puede exportar un solo local', async () => {
    sessionWith([principal, sucursal])
    const wrapper = mount(SalesExportForm)
    await flushPromises()

    await wrapper.get('#sales-export-establishment').setValue('2')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(dataTransferApi.exportSales).toHaveBeenCalledWith(expect.objectContaining({ establishment_id: 2 }))
  })

  it('RF-010: con un solo local no hay filtro de local', () => {
    sessionWith([principal])
    expect(mount(SalesExportForm).find('#sales-export-establishment').exists()).toBe(false)
  })
})
