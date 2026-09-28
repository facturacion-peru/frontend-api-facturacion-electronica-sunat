import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
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
  },
}))

const { usersApi } = await import('../api')
const UsersView = (await import('../views/UsersView.vue')).default

const ana: CompanyUser = { id: 1, name: 'Ana', email: 'ana@example.com', role: 'company_admin', active: true, last_login_at: null }
const luis: CompanyUser = { id: 2, name: 'Luis', email: 'luis@example.com', role: 'seller', active: true, last_login_at: '2026-09-28T10:00:00Z' }
const pending: PendingInvitation = {
  id: 9, email: 'nuevo@example.com', role: 'seller', expires_at: '2026-10-01T00:00:00Z', expired: false, invited_by: null, created_at: null,
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

    expect(usersApi.invite).toHaveBeenCalledWith('nuevo@example.com', 'company_admin')
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
})
