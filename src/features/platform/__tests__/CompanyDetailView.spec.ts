import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { PlatformCompanyDetail } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  platformApi: {
    company: vi.fn<AsyncFn>(), update: vi.fn<AsyncFn>(), deactivate: vi.fn<AsyncFn>(), activate: vi.fn<AsyncFn>(),
    resendAdminInvitation: vi.fn<AsyncFn>(), searchUbigeos: vi.fn<AsyncFn>(),
  },
}))

const { platformApi } = await import('../api')
const CompanyDetailView = (await import('../views/CompanyDetailView.vue')).default

const company: PlatformCompanyDetail = {
  id: 1, ruc: '20600000013', razon_social: 'Bodega Alfa S.A.C.', nombre_comercial: 'Alfa', active: true, sunat_status: 'validated',
  sunat_status_label: 'Validada', sunat_reason: null, users_count: 3, pending_documents: 2, rejected_documents: 0, created_at: null,
  person_type: 'juridica', tax_regime: 'rmt', tax_regime_label: 'Régimen MYPE Tributario', email: 'contacto@alfa.pe', phone: null,
  fiscal_address: { address: 'Av. Uno 1', ubigeo: '150101', district: 'Lima / Lima / Lima' },
  admin: { name: null, email: 'jefe@alfa.pe', invitation: 'expired' }, active_users: 2, last_activity_at: '2026-09-25T18:30:00+00:00',
}

const open = () => mountWithRouter(CompanyDetailView, { path: '/plataforma/empresas/1', pattern: '/plataforma/empresas/:id' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(platformApi.company).mockResolvedValue(company)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CompanyDetailView', () => {
  it('muestra datos legales, estado y administrador, con enlace a soporte si hay pendientes', async () => {
    const { wrapper } = await open()

    expect(wrapper.find('[data-test="legal"]').text()).toContain('20600000013')
    expect(wrapper.find('[data-test="status"]').text()).toContain('Validada')
    expect(wrapper.find('[data-test="status"]').text()).toContain('2 de 3')
    expect(wrapper.find('[data-test="admin"]').text()).toContain('jefe@alfa.pe')
    expect(wrapper.text()).toContain('Ver en soporte')
  })

  it('reenvía la invitación vencida', async () => {
    vi.mocked(platformApi.resendAdminInvitation).mockResolvedValue({ ...company, admin: { ...company.admin, invitation: 'pending' } })
    const { wrapper } = await open()

    await wrapper.findAll('button').find((b) => b.text() === 'Reenviar invitación')!.trigger('click')
    await flushPromises()

    expect(platformApi.resendAdminInvitation).toHaveBeenCalledWith(1)
    expect(wrapper.find('[data-test="notice"]').text()).toContain('El enlace anterior ya no sirve')
  })

  it('al corregir el RUC avisa que SUNAT vuelve a validarse', async () => {
    vi.mocked(platformApi.update).mockResolvedValue({ ...company, ruc: '20100070970', sunat_status: 'pending', sunat_status_label: 'Pendiente de validación' })
    const { wrapper } = await open()

    await wrapper.findAll('button').find((b) => b.text() === 'Corregir')!.trigger('click')
    await flushPromises()
    const ruc = document.querySelector<HTMLInputElement>('#edit-ruc')!
    ruc.value = '20100070970'
    ruc.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(document.querySelector('[data-test="ruc-warning"]')!.textContent).toContain('vuelve a «pendiente»')

    document.querySelector<HTMLFormElement>('#legal-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(platformApi.update).toHaveBeenCalledWith(1, expect.objectContaining({ ruc: '20100070970', fiscal_address: { address: 'Av. Uno 1', ubigeo: '150101' } }))
    expect(wrapper.find('[data-test="notice"]').text()).toContain('certificado del nuevo RUC')
  })

  it('suspender exige un motivo', async () => {
    vi.mocked(platformApi.deactivate)
      .mockRejectedValueOnce(new ApiError(422, 'x', { reason: ['El campo motivo es obligatorio.'] }))
      .mockResolvedValueOnce({ ...company, active: false })
    const { wrapper } = await open()

    await wrapper.findAll('button').find((b) => b.text() === 'Suspender empresa')!.trigger('click')
    await flushPromises()
    document.querySelector<HTMLFormElement>('#suspend-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()
    expect(document.querySelector('#suspend-reason-error')!.textContent).toContain('obligatorio')

    const reason = document.querySelector<HTMLInputElement>('#suspend-reason')!
    reason.value = 'Falta de pago'
    reason.dispatchEvent(new Event('input'))
    document.querySelector<HTMLFormElement>('#suspend-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(platformApi.deactivate).toHaveBeenLastCalledWith(1, 'Falta de pago')
    expect(wrapper.find('[data-test="active"]').text()).toBe('Suspendida')
  })

  it('reactiva una empresa suspendida', async () => {
    vi.mocked(platformApi.company).mockResolvedValue({ ...company, active: false })
    vi.mocked(platformApi.activate).mockResolvedValue(company)
    const { wrapper } = await open()

    await wrapper.findAll('button').find((b) => b.text() === 'Reactivar empresa')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="active"]').text()).toBe('Activa')
  })
})
