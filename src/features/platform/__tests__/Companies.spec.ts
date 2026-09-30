import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { PlatformCompany, PlatformCompanyDetail } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  platformApi: { companies: vi.fn<AsyncFn>(), create: vi.fn<AsyncFn>(), searchUbigeos: vi.fn<AsyncFn>() },
}))

const { platformApi } = await import('../api')
const CompaniesView = (await import('../views/CompaniesView.vue')).default
const NewCompanyView = (await import('../views/NewCompanyView.vue')).default

const alfa: PlatformCompany = {
  id: 1, ruc: '20600000013', razon_social: 'Bodega Alfa S.A.C.', nombre_comercial: 'Alfa', active: true, sunat_status: 'validated',
  sunat_status_label: 'Validada', sunat_reason: null, users_count: 3, pending_documents: 2, rejected_documents: 1, created_at: null,
}
const beta: PlatformCompany = { ...alfa, id: 2, razon_social: 'Ferretería Beta', active: false, sunat_status: 'inactive', sunat_status_label: 'Inactiva', pending_documents: 0, rejected_documents: 0 }
const page = (data: PlatformCompany[]) => ({ success: true as const, data, meta: { current_page: 1, per_page: 20, total: data.length, last_page: 1, from: 1, to: data.length } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(platformApi.companies).mockResolvedValue(page([alfa, beta]))
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('CompaniesView', () => {
  it('muestra el estado, SUNAT y los comprobantes con problemas de cada empresa', async () => {
    const { wrapper } = await mountWithRouter(CompaniesView)

    const [first, second] = wrapper.findAll('[data-test="company-row"]')
    expect(first!.text()).toContain('SUNAT: Validada')
    expect(first!.find('[data-test="pending"]').text()).toBe('2 pendientes')
    expect(first!.find('[data-test="rejected"]').text()).toBe('1 rechazado')
    expect(second!.text()).toContain('Suspendida')
  })

  it('busca y filtra «con problemas de emisión»', async () => {
    const { wrapper } = await mountWithRouter(CompaniesView)

    await wrapper.find('#companies-search').setValue('alfa')
    await wrapper.find('#companies-search').trigger('input')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(platformApi.companies).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'alfa', page: 1 }))

    await wrapper.find('#companies-issues').setValue(true)
    await flushPromises()
    expect(platformApi.companies).toHaveBeenLastCalledWith(expect.objectContaining({ issues: true }))
  })
})

describe('NewCompanyView', () => {
  it('registra la empresa con el ubigeo elegido y va a su ficha', async () => {
    vi.mocked(platformApi.searchUbigeos).mockResolvedValue([{ id: '150122', nombre: 'Miraflores', provincia: 'Lima', region: 'Lima', ubigeo_completo: 'Lima - Lima - Miraflores' }])
    vi.mocked(platformApi.create).mockResolvedValue({ id: 9 } as PlatformCompanyDetail)
    const { wrapper, router } = await mountWithRouter(NewCompanyView)

    await wrapper.find('#ruc').setValue('20131312955')
    await wrapper.find('#razon_social').setValue('Nueva S.A.C.')
    await wrapper.find('#address').setValue('Av. Larco 1')
    await wrapper.find('#ubigeo').setValue('mira')
    await wrapper.find('#ubigeo').trigger('input')
    vi.advanceTimersByTime(300)
    await flushPromises()
    await wrapper.find('[data-test="ubigeo-results"] button').trigger('click')
    await wrapper.find('#email').setValue('contacto@nueva.pe')
    await wrapper.find('#admin_email').setValue('jefe@nueva.pe')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(platformApi.create).toHaveBeenCalledWith(expect.objectContaining({ ruc: '20131312955', ubigeo: '150122', admin_email: 'jefe@nueva.pe', tax_regime: 'rmt' }))
    expect(router.currentRoute.value.name).toBe('platform-company')
  })

  it('muestra los errores por campo (RUC repetido)', async () => {
    vi.mocked(platformApi.create).mockRejectedValue(new ApiError(422, 'x', { ruc: ['Esta empresa ya está registrada en la plataforma.'] }))
    const { wrapper } = await mountWithRouter(NewCompanyView)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#ruc-error').text()).toContain('ya está registrada')
  })
})
