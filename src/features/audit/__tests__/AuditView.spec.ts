import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { AuditPage } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ auditApi: { list: vi.fn<AsyncFn>(), users: vi.fn<AsyncFn>() } }))

const { auditApi } = await import('../api')
const AuditView = (await import('../views/AuditView.vue')).default

const page = (current: number, last: number): AuditPage => ({
  data: [
    {
      id: 1, action: 'user.role_changed', actor: { id: 1, name: 'Ana' }, auditable_type: 'user', auditable_id: 2,
      changes: { from: 'seller', to: 'company_admin' }, ip: '203.0.113.7', user_agent: null, created_at: '2026-09-28T10:00:00Z',
    },
  ],
  meta: { current_page: current, per_page: 25, total: 30, last_page: last, from: 1, to: 25 },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auditApi.list).mockResolvedValue(page(1, 2))
  vi.mocked(auditApi.users).mockResolvedValue([{ id: 1, name: 'Ana' }, { id: 2, name: 'Luis' }])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AuditView', () => {
  it('muestra los registros con nombre legible de la acción', async () => {
    const { wrapper } = await mountWithRouter(AuditView)

    const row = wrapper.find('[data-test="audit-row"]')
    expect(row.text()).toContain('Rol cambiado')
    expect(row.text()).toContain('Ana')
  })

  it('aplica los filtros y vuelve a la primera página', async () => {
    const { wrapper } = await mountWithRouter(AuditView)

    await wrapper.find('#filter-action').setValue('user.role_changed')
    await wrapper.find('#filter-actor').setValue('2')
    await wrapper.find('#filter-from').setValue('2026-09-01')
    await wrapper.find('#filter-to').setValue('2026-09-30')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(auditApi.list).toHaveBeenLastCalledWith({
      action: 'user.role_changed', actor_id: '2', from: '2026-09-01', to: '2026-09-30', page: 1,
    })
  })

  it('pagina', async () => {
    const { wrapper } = await mountWithRouter(AuditView)
    vi.mocked(auditApi.list).mockResolvedValue(page(2, 2))

    await wrapper.findAll('nav[aria-label="Paginación"] button')[1]!.trigger('click')
    await flushPromises()

    expect(vi.mocked(auditApi.list).mock.lastCall?.[0]).toMatchObject({ page: 2 })
    expect(wrapper.text()).toContain('Página 2 de 2')
  })
})
