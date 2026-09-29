import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import type { Customer } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ customersApi: { search: vi.fn<AsyncFn>(), create: vi.fn<AsyncFn>() } }))

const { customersApi } = await import('../api')
const CustomerPicker = (await import('../components/CustomerPicker.vue')).default

const maria: Customer = { id: 1, document_type: '1', document_type_label: 'DNI', document_number: '46027897', name: 'MARIA QUISPE', address: null }
const ferreteria: Customer = { id: 2, document_type: '6', document_type_label: 'RUC', document_number: '20100070970', name: 'FERRETERIA EL SOL S.A.C.', address: 'Av. Uno' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(customersApi.search).mockResolvedValue([maria, ferreteria])
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function mountPicker(props: { requireRuc?: boolean } = {}) {
  const wrapper = mount(CustomerPicker, { props: { modelValue: null, ...props }, attachTo: document.body })
  wrapper.setProps({ 'onUpdate:modelValue': (v: Customer | null) => wrapper.setProps({ modelValue: v }) })

  return wrapper
}

async function searchFor(wrapper: Awaited<ReturnType<typeof mountPicker>>, term: string) {
  await wrapper.find('#customer-search').setValue(term)
  await wrapper.find('#customer-search').trigger('input')
  vi.advanceTimersByTime(300)
  await flushPromises()
}

describe('CustomerPicker', () => {
  it('busca y selecciona un cliente', async () => {
    const wrapper = await mountPicker()

    await searchFor(wrapper, 'maria')
    await wrapper.findAll('[data-test="customer-results"] button')[0]!.trigger('click')

    expect(customersApi.search).toHaveBeenCalledWith('maria')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([maria])
    expect(wrapper.find('[data-test="selected-customer"]').text()).toContain('DNI 46027897')
  })

  it('para factura solo deja elegir clientes con RUC', async () => {
    const wrapper = await mountPicker({ requireRuc: true })

    await searchFor(wrapper, 'a')
    const [dni, ruc] = wrapper.findAll('[data-test="customer-results"] button')

    expect(dni!.attributes('disabled')).toBeDefined()
    expect(dni!.text()).toContain('la factura requiere RUC')
    expect(ruc!.attributes('disabled')).toBeUndefined()
  })

  it('registra un cliente nuevo y lo selecciona', async () => {
    vi.mocked(customersApi.create).mockResolvedValue(maria)
    const wrapper = await mountPicker()

    await searchFor(wrapper, '46027897')
    await wrapper.findAll('button').find((b) => b.text().includes('Registrar cliente'))!.trigger('click')
    await flushPromises()

    const number = document.querySelector<HTMLInputElement>('#new-customer-number')!
    expect(number.value).toBe('46027897')
    const name = document.querySelector<HTMLInputElement>('#new-customer-name')!
    name.value = 'María Quispe'
    name.dispatchEvent(new Event('input'))
    document.querySelector<HTMLFormElement>('#customer-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(customersApi.create).toHaveBeenCalledWith({ document_type: '1', document_number: '46027897', name: 'María Quispe', address: null })
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([maria])
    expect(document.querySelector('#customer-form')).toBeNull()
  })

  it('muestra el error del documento', async () => {
    vi.mocked(customersApi.create).mockRejectedValue(
      new ApiError(422, 'x', { document_number: ['El RUC no es válido: el dígito verificador no coincide.'] }),
    )
    const wrapper = await mountPicker({ requireRuc: true })

    await wrapper.findAll('button').find((b) => b.text().includes('Registrar cliente'))!.trigger('click')
    await flushPromises()
    expect(document.querySelector<HTMLSelectElement>('#new-customer-type')!.value).toBe('6')
    document.querySelector<HTMLFormElement>('#customer-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(document.querySelector('#new-customer-number-error')!.textContent).toContain('dígito verificador')
  })
})
