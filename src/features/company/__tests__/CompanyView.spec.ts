import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { CompanyDetail } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  companyApi: { get: vi.fn<AsyncFn>(), update: vi.fn<AsyncFn>(), uploadLogo: vi.fn<AsyncFn>() },
}))

const { companyApi } = await import('../api')
const CompanyView = (await import('../views/CompanyView.vue')).default

const company: CompanyDetail = {
  id: 7, ruc: '20131312955', razon_social: 'Bodega Ana S.A.C.', nombre_comercial: 'Bodega Ana',
  person_type: 'juridica', tax_regime: 'rmt', email: 'contacto@bodega.pe', phone: null, logo_url: null, active: true,
  fiscal_address: { address: 'Av. Uno 1', ubigeo: '150101', district: 'Lima / Lima / Lima' }, created_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(companyApi.get).mockResolvedValue(company)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CompanyView', () => {
  it('muestra RUC y razón social como datos de solo lectura', async () => {
    const { wrapper } = await mountWithRouter(CompanyView)

    const legal = wrapper.find('[data-test="legal-data"]')
    expect(legal.text()).toContain('20131312955')
    expect(legal.text()).toContain('Bodega Ana S.A.C.')
    expect(legal.text()).toContain('Régimen MYPE Tributario')
    expect(wrapper.find('input#ruc').exists()).toBe(false)
  })

  it('guarda solo los datos de contacto', async () => {
    vi.mocked(companyApi.update).mockResolvedValue({ ...company, phone: '987654321' })
    const { wrapper } = await mountWithRouter(CompanyView)

    await wrapper.find('#phone').setValue('987654321')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(companyApi.update).toHaveBeenCalledWith({ nombre_comercial: 'Bodega Ana', email: 'contacto@bodega.pe', phone: '987654321' })
    expect(wrapper.text()).toContain('Cambios guardados.')
  })

  it('muestra los errores por campo', async () => {
    vi.mocked(companyApi.update).mockRejectedValue(new ApiError(422, 'x', { email: ['El campo correo debe ser válido.'] }))
    const { wrapper } = await mountWithRouter(CompanyView)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#company-email-error').text()).toBe('El campo correo debe ser válido.')
  })
})
