import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { useSessionStore } from '@/core/auth/session-store'
import type { Establishment } from '@/shared/establishments/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { CompanyUser, PendingInvitation } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  usersApi: {
    listUsers: vi.fn<AsyncFn>(),
    updateUser: vi.fn<AsyncFn>(),
    listInvitations: vi.fn<AsyncFn>(),
    invite: vi.fn<AsyncFn>(),
    resendInvitation: vi.fn<AsyncFn>(),
    cancelInvitation: vi.fn<AsyncFn>(),
    assignEstablishments: vi.fn<AsyncFn>(),
  },
}))
vi.mock('@/shared/establishments/api', () => ({ establishmentsApi: { list: vi.fn<AsyncFn>() } }))

const { usersApi } = await import('../api')
const { establishmentsApi } = await import('@/shared/establishments/api')
const UsersView = (await import('../views/UsersView.vue')).default

const ana: CompanyUser = { id: 1, name: 'Ana', email: 'ana@example.com', role: 'company_admin', active: true, last_login_at: null, establishment_ids: null }
const luis: CompanyUser = { id: 2, name: 'Luis', email: 'luis@example.com', role: 'seller', active: true, last_login_at: '2026-09-28T10:00:00Z', establishment_ids: [1] }
const pending: PendingInvitation = {
  id: 9, email: 'nuevo@example.com', role: 'seller', expires_at: '2026-10-01T00:00:00Z', expired: false, invited_by: null, created_at: null, establishment_ids: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usersApi.listUsers).mockResolvedValue([ana, luis])
  vi.mocked(usersApi.listInvitations).mockResolvedValue([pending])
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UsersView', () => {
  it('lista usuarios e invitaciones pendientes', async () => {
    const { wrapper } = await mountWithRouter(UsersView)

    expect(wrapper.findAll('[data-test="user-row"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="invitation-row"]').text()).toContain('nuevo@example.com')
  })

  it('invita a un usuario y recarga la lista', async () => {
    vi.mocked(usersApi.invite).mockResolvedValue(pending)
    const { wrapper } = await mountWithRouter(UsersView)

    await wrapper.find('button').trigger('click')
    await flushPromises()
    const email = document.getElementById('invite-email') as HTMLInputElement
    email.value = 'nuevo@example.com'
    email.dispatchEvent(new Event('input'))
    ;(document.querySelector('input[value="company_admin"]') as HTMLInputElement).click()
    document.getElementById('invite-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(usersApi.invite).toHaveBeenCalledWith('nuevo@example.com', 'company_admin', undefined)
    expect(usersApi.listUsers).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Invitación enviada.')
  })

  it('muestra el error de correo no disponible en el diálogo', async () => {
    vi.mocked(usersApi.invite).mockRejectedValue(new ApiError(422, 'x', { email: ['Este correo no está disponible.'] }))
    const { wrapper } = await mountWithRouter(UsersView)

    await wrapper.find('button').trigger('click')
    await flushPromises()
    document.getElementById('invite-form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(document.getElementById('invite-email-error')?.textContent).toBe('Este correo no está disponible.')
  })

  it('desactiva a un usuario', async () => {
    vi.mocked(usersApi.updateUser).mockResolvedValue({ ...luis, active: false })
    const { wrapper } = await mountWithRouter(UsersView)

    const buttons = wrapper.findAll('[data-test="user-row"]')[1]!.findAll('button')
    await buttons[buttons.length - 1]!.trigger('click')
    await flushPromises()

    expect(usersApi.updateUser).toHaveBeenCalledWith(2, { active: false })
  })

  it('muestra el mensaje de la API al intentar dejar la empresa sin administrador', async () => {
    vi.mocked(usersApi.updateUser).mockRejectedValue(
      new ApiError(422, 'Los datos enviados no son válidos.', { user: ['La empresa debe tener al menos un administrador activo.'] }),
    )
    const { wrapper } = await mountWithRouter(UsersView)

    const select = wrapper.find('#role-1')
    await select.setValue('seller')
    await flushPromises()

    expect(usersApi.updateUser).toHaveBeenCalledWith(1, { role: 'seller' })
    expect(wrapper.find('[role="alert"]').text()).toBe('La empresa debe tener al menos un administrador activo.')
  })

  it('reenvía y cancela invitaciones', async () => {
    vi.mocked(usersApi.resendInvitation).mockResolvedValue(pending)
    vi.mocked(usersApi.cancelInvitation).mockResolvedValue({})
    const { wrapper } = await mountWithRouter(UsersView)

    const buttons = wrapper.find('[data-test="invitation-row"]').findAll('button')
    await buttons[0]!.trigger('click')
    await flushPromises()
    expect(usersApi.resendInvitation).toHaveBeenCalledWith(9)

    await wrapper.find('[data-test="invitation-row"]').findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(usersApi.cancelInvitation).toHaveBeenCalledWith(9)
  })

  describe('con varios locales (spec 017, A-87)', () => {
    const principal: Establishment = {
      id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123', ubigeo: '150101', district: null, is_main: true, active: true, code_locked: true,
    }
    const sucursal: Establishment = { ...principal, id: 2, code: '0001', name: 'Sucursal Centro', is_main: false }
    const cerrado: Establishment = { ...principal, id: 3, code: '0002', name: 'Cerrado', is_main: false, active: false }

    const mountMulti = () =>
      mountWithRouter(UsersView, {
        beforeMount: () => {
          useSessionStore().session = {
            user: { id: 1, name: 'Ana', email: 'ana@example.com' }, platform_admin: false, role: 'company_admin',
            company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null, logo_url: null, active_establishments_count: 2 },
            establishments: [principal, sucursal],
          }
        },
      })

    beforeEach(() => {
      vi.mocked(establishmentsApi.list).mockResolvedValue([principal, sucursal, cerrado])
    })

    it('el administrador trabaja en todos; el vendedor muestra sus locales', async () => {
      vi.mocked(usersApi.listUsers).mockResolvedValue([ana, luis, { ...luis, id: 3, name: 'Rosa', establishment_ids: [3] }])
      const { wrapper } = await mountMulti()

      const rows = wrapper.findAll('[data-test="user-row"]')
      expect(rows[0]!.get('[data-test="user-establishments"]').text()).toBe('Todos los locales')
      expect(rows[0]!.find('[data-test="edit-establishments"]').exists()).toBe(false)
      expect(rows[1]!.get('[data-test="user-establishments"]').text()).toBe('Locales: Principal')
      expect(rows[2]!.get('[data-test="user-establishments"]').text()).toBe('Locales: Cerrado')
    })

    it('«Locales» guarda la asignación con PUT y avisa', async () => {
      vi.mocked(usersApi.assignEstablishments).mockResolvedValue({ ...luis, establishment_ids: [1, 2] })
      const { wrapper } = await mountMulti()

      await wrapper.findAll('[data-test="user-row"]')[1]!.get('[data-test="edit-establishments"]').trigger('click')
      await flushPromises()
      const boxes = document.querySelectorAll<HTMLInputElement>('input[name="assign-establishments"]')
      expect([...boxes].map((b) => b.checked)).toEqual([true, false])
      boxes[1]!.click()
      document.getElementById('assign-form')!.dispatchEvent(new Event('submit'))
      await flushPromises()

      expect(usersApi.assignEstablishments).toHaveBeenCalledWith(2, [1, 2])
      expect(wrapper.text()).toContain('Locales de Luis actualizados.')
    })

    it('sin ningún local, el error de la API se ve en las casillas', async () => {
      vi.mocked(usersApi.assignEstablishments).mockRejectedValue(
        new ApiError(422, 'x', { 'establishment_ids.0': ['El local no está activo.'] }),
      )
      const { wrapper } = await mountMulti()

      await wrapper.findAll('[data-test="user-row"]')[1]!.get('[data-test="edit-establishments"]').trigger('click')
      await flushPromises()
      document.getElementById('assign-form')!.dispatchEvent(new Event('submit'))
      await flushPromises()

      expect(document.querySelector('[data-test="establishments-error"]')!.textContent).toBe('El local no está activo.')
    })

    it('al invitar a un vendedor pide sus locales; a un administrador no', async () => {
      vi.mocked(usersApi.invite).mockResolvedValue(pending)
      const { wrapper } = await mountMulti()

      await wrapper.find('button').trigger('click')
      await flushPromises()
      expect(document.querySelectorAll('input[name="invite-establishments"]')).toHaveLength(2)
      document.querySelectorAll<HTMLInputElement>('input[name="invite-establishments"]')[1]!.click()
      document.getElementById('invite-form')!.dispatchEvent(new Event('submit'))
      await flushPromises()
      expect(usersApi.invite).toHaveBeenCalledWith('', 'seller', [2])

      await wrapper.find('button').trigger('click')
      await flushPromises()
      ;(document.querySelector('input[value="company_admin"]') as HTMLInputElement).click()
      await flushPromises()
      expect(document.querySelector('input[name="invite-establishments"]')).toBeNull()
    })
  })
})
