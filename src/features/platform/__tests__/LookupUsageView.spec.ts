import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import { platformRoutes } from '../routes'
import type { LookupUsageDay } from '../types'

/*
 * Spec 018 · F009 (HU-4): uso del servicio de consulta en el panel de la plataforma.
 */
vi.mock('../api', () => ({ platformApi: { lookupUsage: vi.fn<() => Promise<LookupUsageDay[]>>() } }))

const { platformApi } = await import('../api')
const LookupUsageView = (await import('../views/LookupUsageView.vue')).default

const day = (date: string, total: number, failed = 0): LookupUsageDay => ({ date, total, found: total - failed, not_found: 0, failed })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('LookupUsageView', () => {
  it('es una ruta del panel de la plataforma', () => {
    expect(platformRoutes.find((r) => r.name === 'platform-lookups')).toMatchObject({ path: 'consultas' })
  })

  it('muestra el total de hoy y los días del más reciente al más antiguo', async () => {
    vi.mocked(platformApi.lookupUsage).mockResolvedValue([day('2026-10-28', 0), day('2026-10-29', 12, 2), day('2026-10-30', 3)])
    const { wrapper } = await mountWithRouter(LookupUsageView)

    expect(wrapper.get('[data-test="lookups-today"]').text()).toContain('3 consultas')
    const rows = wrapper.findAll('[data-test="lookups-table"] tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.findAll('td').map((c) => c.text())).toEqual(['3', '3', '0', '0'])
    expect(rows[1]!.findAll('td').map((c) => c.text())).toEqual(['12', '10', '0', '2'])
    expect(wrapper.find('[data-test="lookups-table"]').text()).not.toMatch(/\d{8}/)
  })
})
