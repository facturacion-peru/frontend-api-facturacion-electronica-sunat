import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/core/auth/session-store'
import type { CompanyRole } from '@/core/auth/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import { summary } from '@/features/dashboard/__tests__/fixtures'

/*
 * Spec 011 · T010/T012: el Inicio compone el panel.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('@/features/dashboard/api', () => ({ dashboardApi: { summary: vi.fn<AsyncFn>() } }))
vi.mock('@/features/sunat/components/SunatStatusCard.vue', () => ({ default: { template: '<div data-test="sunat-card" />' } }))

const { dashboardApi } = await import('@/features/dashboard/api')
const HomeView = (await import('@/app/views/HomeView.vue')).default

function mountAs(role: CompanyRole) {
  return mountWithRouter(HomeView, {
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Ana Pérez', email: 'ana@demo.test' }, platform_admin: false,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo S.A.C.', nombre_comercial: 'Bodega Demo' }, role,
      }
    },
  })
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  document.body.innerHTML = ''
})

describe('HomeView', () => {
  it('HU-3 «Nueva venta» es lo primero tras el saludo, y el panel carga en una sola petición (CE-002)', async () => {
    vi.mocked(dashboardApi.summary).mockResolvedValue(summary())
    const { wrapper } = await mountAs('company_admin')

    const first = wrapper.find('a')
    expect(first.text()).toContain('Nueva venta')
    expect(first.attributes('href')).toBe('/__new-sale')
    expect(dashboardApi.summary).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Hola, Ana')
    expect(wrapper.text()).toContain('Ventas de hoy')
    expect(wrapper.text()).toContain('Últimos 7 días')
    expect(wrapper.find('[data-test="sunat-card"]').exists()).toBe(true)
  })

  it('al vendedor le habla de sus ventas (A-53)', async () => {
    vi.mocked(dashboardApi.summary).mockResolvedValue(summary({ scope: 'own' }))
    const { wrapper } = await mountAs('seller')

    expect(wrapper.text()).toContain('Tus ventas de hoy')
  })

  it('si falla, lo dice y permite reintentar', async () => {
    vi.mocked(dashboardApi.summary).mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce(summary())
    const { wrapper } = await mountAs('seller')

    expect(wrapper.text()).toContain('No se pudo cargar el resumen')
    await wrapper.get('[data-test="retry"]').trigger('click')
    await flushPromises()

    expect(dashboardApi.summary).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Ventas de hoy')
  })
})
