import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import type { Customer } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ customersApi: { search: vi.fn<AsyncFn>(), create: vi.fn<AsyncFn>(), lookup: vi.fn<AsyncFn>(), refresh: vi.fn<AsyncFn>() } }))

const { customersApi } = await import('../api')
const CustomerPicker = (await import('../components/CustomerPicker.vue')).default

const maria: Customer = { id: 1, document_type: '1', document_type_label: 'DNI', document_number: '46027897', name: 'MARIA QUISPE', address: null, verified: false, verified_at: null, ruc_status: null, ruc_condition: null }
const ferreteria: Customer = { id: 2, document_type: '6', document_type_label: 'RUC', document_number: '20100070970', name: 'FERRETERIA EL SOL S.A.C.', address: 'Av. Uno', verified: false, verified_at: null, ruc_status: null, ruc_condition: null }

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

  describe('consulta por DNI o RUC (spec 018)', () => {
    const verified: Customer = {
      ...ferreteria, id: 7, address: 'AV. UNO 123 LIMA LIMA LIMA', verified: true, verified_at: '2026-10-30T10:00:00-05:00',
      ruc_status: 'ACTIVO', ruc_condition: 'HABIDO',
    }

    it('HU-1 esc. 3: un RUC encontrado queda elegido solo, con la insignia y la dirección, sin buscar por nombre', async () => {
      vi.mocked(customersApi.lookup).mockResolvedValue({ customer: verified, source: 'service', reason: null })
      const wrapper = await mountPicker({ requireRuc: true })

      await searchFor(wrapper, '20100070970')

      expect(customersApi.lookup).toHaveBeenCalledWith('6', '20100070970', expect.any(AbortSignal))
      expect(customersApi.search).not.toHaveBeenCalled()
      expect(wrapper.emitted('update:modelValue')).toEqual([[verified]])
      const card = wrapper.get('[data-test="selected-customer"]')
      expect(card.find('[data-test="customer-verified"]').exists()).toBe(true)
      expect(card.get('[data-test="selected-address"]').text()).toBe('AV. UNO 123 LIMA LIMA LIMA')
    })

    it('A-95: un RUC de baja se elige con el aviso', async () => {
      vi.mocked(customersApi.lookup).mockResolvedValue({ customer: { ...verified, ruc_status: 'BAJA DE OFICIO' }, source: 'platform', reason: null })
      const wrapper = await mountPicker()

      await searchFor(wrapper, '20100070970')

      expect(wrapper.get('[data-test="ruc-status-alert"]').text()).toContain('BAJA DE OFICIO')
    })

    it.each([
      ['not_found', 'No encontramos ese DNI en RENIEC.'],
      ['unavailable', 'El servicio de consulta no responde.'],
      ['quota', 'Se acabaron las consultas automáticas de hoy.'],
      ['disabled', 'La consulta automática no está disponible.'],
    ] as const)('HU-1 esc. 5: con %s dice por qué y ofrece registrar a mano con el número', async (reason, message) => {
      vi.mocked(customersApi.lookup).mockResolvedValue({ customer: null, source: null, reason })
      const wrapper = await mountPicker()

      await searchFor(wrapper, '46027897')
      expect(wrapper.get('[data-test="lookup-status"]').text()).toContain(message)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      await wrapper.get('[data-test="register-manually"]').trigger('click')
      expect((document.getElementById('new-customer-number') as HTMLInputElement).value).toBe('46027897')
      expect((document.getElementById('new-customer-type') as HTMLSelectElement).value).toBe('1')
    })

    it('un cliente manual que no se pudo verificar se elige igual, con el motivo', async () => {
      vi.mocked(customersApi.lookup).mockResolvedValue({ customer: maria, source: 'company', reason: 'unavailable' })
      const wrapper = await mountPicker()

      await searchFor(wrapper, '46027897')

      expect(wrapper.emitted('update:modelValue')).toEqual([[maria]])
      expect(wrapper.find('[data-test="customer-manual"]').exists()).toBe(true)
      expect(wrapper.get('[data-test="unverified-note"]').text()).toBe(
        'El servicio de consulta no responde. Se usa el cliente registrado a mano.',
      )
    })

    it('mientras consulta lo anuncia; un RUC inválido avisa sin consultar', async () => {
      vi.mocked(customersApi.lookup).mockImplementation(() => new Promise(() => {}))
      const wrapper = await mountPicker()

      await searchFor(wrapper, '20100070970')
      expect(wrapper.get('[data-test="lookup-status"]').attributes('aria-live')).toBe('polite')
      expect(wrapper.get('[data-test="lookup-status"]').text()).toBe('Buscando en SUNAT…')

      vi.mocked(customersApi.lookup).mockClear()
      await searchFor(wrapper, '20100070971')
      expect(wrapper.get('[data-test="lookup-status"]').text()).toBe('El RUC no es válido: revisa los números.')
      expect(customersApi.lookup).not.toHaveBeenCalled()
    })
  })

  describe('«Actualizar datos» al vender (spec 018, HU-3)', () => {
    const mountWith = (modelValue: Customer) => {
      const wrapper = mount(CustomerPicker, { props: { modelValue }, attachTo: document.body })
      wrapper.setProps({ 'onUpdate:modelValue': (v: Customer | null) => wrapper.setProps({ modelValue: v }) })
      return wrapper
    }

    it('reemplaza el cliente de la venta y avisa', async () => {
      const updated: Customer = { ...ferreteria, address: 'JR. NUEVO 9', verified: true, verified_at: '2026-10-30T10:00:00-05:00' }
      vi.mocked(customersApi.refresh).mockResolvedValue(updated)
      const wrapper = mountWith(ferreteria)

      await wrapper.get('[data-test="refresh-customer"]').trigger('click')
      await flushPromises()

      expect(customersApi.refresh).toHaveBeenCalledWith(2)
      expect(wrapper.emitted('update:modelValue')).toEqual([[updated]])
      expect(wrapper.get('[data-test="refresh-message"]').text()).toBe('Datos actualizados.')
    })

    it('si el servicio falla, el cliente queda como estaba y se dice por qué', async () => {
      vi.mocked(customersApi.refresh).mockRejectedValue(new ApiError(503, 'El servicio de consulta no responde. Inténtalo más tarde.'))
      const wrapper = mountWith(maria)

      await wrapper.get('[data-test="refresh-customer"]').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.get('[data-test="refresh-message"]').text()).toBe('El servicio de consulta no responde. Inténtalo más tarde.')
    })
  })
})
