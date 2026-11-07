import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/core/api/errors'
import { useSessionStore } from '@/core/auth/session-store'
import type { Establishment } from '@/shared/establishments/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'

/*
 * Spec 017 · F013: crear, editar y desactivar locales (HU-1; A-89 ⚖️).
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>
vi.mock('@/shared/establishments/api', () => ({
  establishmentsApi: { list: vi.fn<AsyncFn>(), create: vi.fn<AsyncFn>(), update: vi.fn<AsyncFn>(), searchUbigeos: vi.fn<AsyncFn>() },
}))

const { establishmentsApi } = await import('@/shared/establishments/api')
const EstablishmentFormView = (await import('../views/EstablishmentFormView.vue')).default

const principal: Establishment = {
  id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123', ubigeo: '150101', district: 'Lima / Lima / Lima', is_main: true, active: true, code_locked: true,
}
const sucursal: Establishment = { ...principal, id: 2, code: '0001', name: 'Sucursal Centro', address: 'Jr. Unión 45', is_main: false, code_locked: false }

function mountForm(path = '/empresa/locales') {
  return mountWithRouter(EstablishmentFormView, {
    path,
    pattern: '/empresa/locales/:id?',
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Ana', email: 'ana@demo.test' },
        platform_admin: false,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null, logo_url: null, active_establishments_count: 1 },
        role: 'company_admin',
        establishments: [principal],
      }
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(establishmentsApi.list).mockResolvedValue([principal, sucursal])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('EstablishmentFormView', () => {
  it('HU-1 esc. 1: crea el local con el aviso A-89 a la vista y vuelve a «Mi empresa»', async () => {
    vi.mocked(establishmentsApi.create).mockResolvedValue(sucursal)
    const { wrapper, router } = await mountForm()

    expect(wrapper.get('[data-test="code-warning"]').text()).toContain('código de anexo de tu ficha RUC')
    expect(wrapper.get('#establishment-code').attributes()).toMatchObject({ inputmode: 'numeric', maxlength: '4' })
    expect(wrapper.find('[data-test="toggle-active"]').exists()).toBe(false)

    await wrapper.get('#establishment-code').setValue('0001')
    await wrapper.get('#establishment-name').setValue('Sucursal Centro')
    await wrapper.get('#establishment-address').setValue('Jr. Unión 45')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(establishmentsApi.create).toHaveBeenCalledWith({ code: '0001', name: 'Sucursal Centro', address: 'Jr. Unión 45', ubigeo: '' })
    expect(establishmentsApi.list).toHaveBeenCalledWith(true)
    expect(useSessionStore().session!.company!.active_establishments_count).toBe(2)
    expect(router.currentRoute.value).toMatchObject({ name: 'company', query: { local: 'creado' } })
  })

  it('HU-1 esc. 2: un código repetido se ve en su campo y no sale de la pantalla', async () => {
    vi.mocked(establishmentsApi.create).mockRejectedValue(
      new ApiError(422, 'Revisa los datos.', { code: ['Ya hay un local con ese código.'] }),
    )
    const { wrapper, router } = await mountForm()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Ya hay un local con ese código.')
    expect(router.currentRoute.value.name).toBeUndefined()
  })

  it('HU-1 esc. 3: con comprobantes el código queda fijo y no se envía', async () => {
    vi.mocked(establishmentsApi.list).mockResolvedValue([principal, { ...sucursal, code_locked: true }])
    vi.mocked(establishmentsApi.update).mockResolvedValue(sucursal)
    const { wrapper } = await mountForm('/empresa/locales/2')

    expect(wrapper.get('#establishment-code').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('el local ya tiene comprobantes')
    await wrapper.get('#establishment-name').setValue('Centro')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(establishmentsApi.update).toHaveBeenCalledWith(2, { name: 'Centro', address: 'Jr. Unión 45', ubigeo: '150101' })
  })

  it('HU-1 esc. 4: desactivar pide confirmación', async () => {
    vi.mocked(establishmentsApi.update).mockResolvedValue({ ...sucursal, active: false })
    const { wrapper, router } = await mountForm('/empresa/locales/2')

    await wrapper.get('[data-test="toggle-active"]').trigger('click')
    await flushPromises()
    expect(establishmentsApi.update).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('¿Desactivar el local?')

    document.querySelector<HTMLButtonElement>('[data-test="confirm-toggle"]')!.click()
    await flushPromises()

    expect(establishmentsApi.update).toHaveBeenCalledWith(2, { active: false })
    expect(router.currentRoute.value).toMatchObject({ name: 'company', query: { local: 'guardado' } })
  })

  it('A-89: el principal no se puede desactivar', async () => {
    const { wrapper } = await mountForm('/empresa/locales/1')

    expect(wrapper.get('#establishment-name').element).toHaveProperty('value', 'Principal')
    expect(wrapper.find('[data-test="toggle-active"]').exists()).toBe(false)
  })

  it('un local que no existe muestra un mensaje', async () => {
    const { wrapper } = await mountForm('/empresa/locales/99')

    expect(wrapper.text()).toContain('No encontramos ese local.')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
