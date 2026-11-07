import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Customer } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ customersApi: { list: vi.fn<AsyncFn>(), update: vi.fn<AsyncFn>(), export: vi.fn<AsyncFn>(), refresh: vi.fn<AsyncFn>() } }))

const { customersApi } = await import('../api')
const CustomersView = (await import('../views/CustomersView.vue')).default

const maria: Customer = { id: 1, document_type: '1', document_type_label: 'DNI', document_number: '46027897', name: 'MARIA QUISPE', address: null, verified: false, verified_at: null, ruc_status: null, ruc_condition: null }
const page = (data: Customer[]) => ({ success: true as const, data, meta: { current_page: 1, per_page: 20, total: data.length, last_page: 1, from: 1, to: data.length } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(customersApi.list).mockResolvedValue(page([maria]))
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('CustomersView', () => {
  it('lista y busca clientes', async () => {
    const { wrapper } = await mountWithRouter(CustomersView)

    expect(wrapper.find('[data-test="customer-row"]').text()).toContain('DNI 46027897')

    await wrapper.find('#customers-search').setValue('maria')
    await wrapper.find('#customers-search').trigger('input')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(customersApi.list).toHaveBeenLastCalledWith('maria', 1)
  })

  it('edita un cliente y avisa que los comprobantes conservan sus datos', async () => {
    vi.mocked(customersApi.update).mockResolvedValue({ ...maria, name: 'MARIA QUISPE HUAMAN' })
    const { wrapper } = await mountWithRouter(CustomersView)

    await wrapper.findAll('button').find((b) => b.text() === 'Editar')!.trigger('click')
    await flushPromises()
    const name = document.querySelector<HTMLInputElement>('#edit-customer-name')!
    expect(name.value).toBe('MARIA QUISPE')
    name.value = 'MARIA QUISPE HUAMAN'
    name.dispatchEvent(new Event('input'))
    document.querySelector<HTMLFormElement>('#edit-customer-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(customersApi.update).toHaveBeenCalledWith(1, { document_type: '1', document_number: '46027897', name: 'MARIA QUISPE HUAMAN', address: null })
    expect(wrapper.text()).toContain('conservan los datos anteriores')
  })

  it('muestra el error de documento repetido', async () => {
    vi.mocked(customersApi.update).mockRejectedValue(new ApiError(422, 'x', { document_number: ['Ya existe un cliente con ese documento.'] }))
    const { wrapper } = await mountWithRouter(CustomersView)

    await wrapper.findAll('button').find((b) => b.text() === 'Editar')!.trigger('click')
    await flushPromises()
    document.querySelector<HTMLFormElement>('#edit-customer-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(document.querySelector('#edit-customer-number-error')!.textContent).toContain('Ya existe un cliente')
  })

  it('exporta los clientes con la búsqueda de la lista (spec 014)', async () => {
    vi.mocked(customersApi.export).mockResolvedValue(undefined)
    const { wrapper } = await mountWithRouter(CustomersView)
    await wrapper.find('#customers-search').setValue(' maria ')

    await wrapper.findAll('button').find((b) => b.text() === 'Exportar')!.trigger('click')
    await flushPromises()
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Descargar')!.click()
    await flushPromises()

    expect(customersApi.export).toHaveBeenCalledWith('maria', 'xlsx')
  })

  describe('clientes verificados (spec 018)', () => {
    const sol: Customer = {
      id: 2, document_type: '6', document_type_label: 'RUC', document_number: '20100070970', name: 'FERRETERIA EL SOL S.A.C.',
      address: 'AV. UNO 123 LIMA LIMA LIMA', verified: true, verified_at: '2026-10-30T10:00:00-05:00', ruc_status: 'ACTIVO', ruc_condition: 'NO HABIDO',
    }
    const extranjero: Customer = { ...maria, id: 3, document_type: '4', document_type_label: 'CE', document_number: '001234567' }

    beforeEach(() => vi.mocked(customersApi.list).mockResolvedValue(page([sol, maria, extranjero])))

    const rows = (wrapper: Awaited<ReturnType<typeof mountWithRouter>>['wrapper']) => wrapper.findAll('[data-test="customer-row"]')

    it('HU-2 esc. 4: cada fila dice si es verificado o manual, con el aviso del RUC', async () => {
      const { wrapper } = await mountWithRouter(CustomersView)

      expect(rows(wrapper)[0]!.find('[data-test="customer-verified"]').exists()).toBe(true)
      expect(rows(wrapper)[0]!.get('[data-test="ruc-status-alert"]').text()).toContain('NO HABIDO')
      expect(rows(wrapper)[1]!.find('[data-test="customer-manual"]').exists()).toBe(true)
      expect(rows(wrapper)[2]!.find('[data-test="refresh-customer"]').exists()).toBe(false)
    })

    it('HU-2 esc. 1: un verificado no deja editar nombre ni dirección; un 422 llega a su campo', async () => {
      vi.mocked(customersApi.update).mockRejectedValue(
        new ApiError(422, 'x', { name: ['Cliente verificado: sus datos vienen de SUNAT o RENIEC. Usa «Actualizar datos».'] }),
      )
      const { wrapper } = await mountWithRouter(CustomersView)

      await rows(wrapper)[0]!.findAll('button').find((b) => b.text() === 'Editar')!.trigger('click')
      await flushPromises()
      expect(document.querySelector<HTMLInputElement>('#edit-customer-name')!.disabled).toBe(true)
      expect(document.querySelector<HTMLInputElement>('#edit-customer-address')!.disabled).toBe(true)
      expect(document.getElementById('edit-customer-name-hint')!.textContent).toBe('Viene de RENIEC o SUNAT. Usa «Actualizar datos».')

      document.querySelector<HTMLFormElement>('#edit-customer-form')!.dispatchEvent(new Event('submit'))
      await flushPromises()
      expect(document.getElementById('edit-customer-name-error')!.textContent).toContain('Cliente verificado')
    })

    it('HU-2 esc. 3: un manual se edita como siempre', async () => {
      const { wrapper } = await mountWithRouter(CustomersView)

      await rows(wrapper)[1]!.findAll('button').find((b) => b.text() === 'Editar')!.trigger('click')
      await flushPromises()
      expect(document.querySelector<HTMLInputElement>('#edit-customer-name')!.disabled).toBe(false)
    })

    it('HU-3: «Actualizar datos» reemplaza la fila; si falla, dice por qué y no cambia nada', async () => {
      vi.mocked(customersApi.refresh).mockResolvedValueOnce({ ...sol, address: 'JR. NUEVO 9 LIMA LIMA LIMA', ruc_condition: 'HABIDO' })
      const { wrapper } = await mountWithRouter(CustomersView)

      await rows(wrapper)[0]!.get('[data-test="refresh-customer"]').trigger('click')
      await flushPromises()
      expect(customersApi.refresh).toHaveBeenCalledWith(2)
      expect(rows(wrapper)[0]!.text()).toContain('JR. NUEVO 9')
      expect(rows(wrapper)[0]!.find('[data-test="ruc-status-alert"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Datos de FERRETERIA EL SOL S.A.C. actualizados.')

      vi.mocked(customersApi.refresh).mockRejectedValueOnce(new ApiError(503, 'Se acabaron las consultas de hoy. Inténtalo mañana.'))
      await rows(wrapper)[1]!.get('[data-test="refresh-customer"]').trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-test="refresh-error"]').text()).toBe('Se acabaron las consultas de hoy. Inténtalo mañana.')
      expect(rows(wrapper)[1]!.text()).toContain('MARIA QUISPE')
    })
  })
})
