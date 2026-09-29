import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Customer } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ customersApi: { list: vi.fn<AsyncFn>(), update: vi.fn<AsyncFn>() } }))

const { customersApi } = await import('../api')
const CustomersView = (await import('../views/CustomersView.vue')).default

const maria: Customer = { id: 1, document_type: '1', document_type_label: 'DNI', document_number: '46027897', name: 'MARIA QUISPE', address: null }
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
})
