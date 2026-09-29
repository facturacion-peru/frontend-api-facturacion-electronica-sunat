import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/core/auth/session-store'
import type { CompanyRole } from '@/core/auth/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SunatStatusInfo } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ sunatApi: { status: vi.fn<AsyncFn>() } }))

const { sunatApi } = await import('../api')
const SunatStatusCard = (await import('../components/SunatStatusCard.vue')).default

const status = (over: Partial<SunatStatusInfo> = {}): SunatStatusInfo => ({
  environment: 'beta', environment_label: 'Pruebas (beta) — sin valor legal', status: 'validated', status_label: 'Validada',
  reason: null, can_issue: true, missing: [], sol_verified: false, certificate_days_to_expire: 200, ...over,
})

async function mountAs(role: CompanyRole) {
  return mountWithRouter(SunatStatusCard, {
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Ana', email: 'ana@demo.test' }, platform_admin: false,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null }, role,
      }
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SunatStatusCard', () => {
  it('indica que se puede emitir, con el distintivo de pruebas', async () => {
    vi.mocked(sunatApi.status).mockResolvedValue(status())
    const { wrapper } = await mountAs('seller')

    expect(wrapper.text()).toContain('Disponible')
    expect(wrapper.find('[data-test="environment-badge"]').exists()).toBe(true)
  })

  it('al vendedor le dice qué falta y a quién pedirlo, sin enlace a la configuración', async () => {
    vi.mocked(sunatApi.status).mockResolvedValue(
      status({ status: 'not_configured', status_label: 'No configurada', can_issue: false, missing: ['Sube el certificado digital.'] }),
    )
    const { wrapper } = await mountAs('seller')

    expect(wrapper.find('[data-test="sunat-missing"]').text()).toContain('Sube el certificado digital.')
    expect(wrapper.text()).toContain('Pide al administrador')
    expect(wrapper.find('a[href="/sunat"]').exists()).toBe(false)
  })

  it('avisa al administrador si el certificado vence en 30 días o menos', async () => {
    vi.mocked(sunatApi.status).mockResolvedValue(status({ certificate_days_to_expire: 12 }))
    const { wrapper } = await mountAs('company_admin')

    expect(wrapper.find('[data-test="certificate-warning"]').text()).toContain('vence en 12 días')
    expect(wrapper.find('a[href="/sunat"]').exists()).toBe(true)
  })

  it('no avisa con más de 30 días', async () => {
    vi.mocked(sunatApi.status).mockResolvedValue(status({ certificate_days_to_expire: 31 }))
    const { wrapper } = await mountAs('company_admin')

    expect(wrapper.find('[data-test="certificate-warning"]').exists()).toBe(false)
  })

  it('el vendedor no ve el aviso de vencimiento', async () => {
    vi.mocked(sunatApi.status).mockResolvedValue(status({ certificate_days_to_expire: 5 }))
    const { wrapper } = await mountAs('seller')

    expect(wrapper.find('[data-test="certificate-warning"]').exists()).toBe(false)
  })

  it('con el certificado vencido muestra el motivo', async () => {
    vi.mocked(sunatApi.status).mockResolvedValue(
      status({ status: 'error', status_label: 'Con error', can_issue: false, reason: 'El certificado está vencido. Sube uno vigente.', certificate_days_to_expire: -3 }),
    )
    const { wrapper } = await mountAs('company_admin')

    expect(wrapper.text()).toContain('El certificado está vencido.')
    expect(wrapper.find('[data-test="certificate-warning"]').text()).toContain('vencido')
  })
})
