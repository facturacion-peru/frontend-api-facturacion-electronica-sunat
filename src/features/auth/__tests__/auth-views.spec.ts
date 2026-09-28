import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { getToken } from '@/core/api/token-storage'
import type { SessionWithToken } from '@/core/auth/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { PublicInvitation } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('@/core/auth/api', () => ({
  authApi: { login: vi.fn<AsyncFn>(), me: vi.fn<AsyncFn>(), logout: vi.fn<AsyncFn>(), acceptInvitation: vi.fn<AsyncFn>() },
}))
vi.mock('../api', () => ({
  authFeatureApi: { getInvitation: vi.fn<AsyncFn>(), forgotPassword: vi.fn<AsyncFn>(), resetPassword: vi.fn<AsyncFn>() },
}))

const { authApi } = await import('@/core/auth/api')
const { authFeatureApi } = await import('../api')
const LoginView = (await import('../views/LoginView.vue')).default
const ForgotPasswordView = (await import('../views/ForgotPasswordView.vue')).default
const ResetPasswordView = (await import('../views/ResetPasswordView.vue')).default
const AcceptInvitationView = (await import('../views/AcceptInvitationView.vue')).default

const sessionWithToken: SessionWithToken = {
  token: '1|abc',
  expires_at: '2026-09-29T12:00:00Z',
  user: { id: 1, name: 'Ana', email: 'ana@example.com' },
  platform_admin: false,
  company: { id: 7, ruc: '20131312955', razon_social: 'Bodega Ana S.A.C.', nombre_comercial: null },
  role: 'company_admin',
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('LoginView', () => {
  it('inicia sesión y vuelve a la ruta de retorno', async () => {
    vi.mocked(authApi.login).mockResolvedValue(sessionWithToken)
    const { wrapper, router } = await mountWithRouter(LoginView, { path: '/?redirect=/usuarios' })
    const replace = vi.spyOn(router, 'replace')

    await wrapper.find('#email').setValue('ana@example.com')
    await wrapper.find('#password').setValue('clave-segura-123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(authApi.login).toHaveBeenCalledWith('ana@example.com', 'clave-segura-123')
    expect(getToken()).toBe('1|abc')
    expect(replace).toHaveBeenCalledWith('/usuarios')
  })

  it('ignora una ruta de retorno externa', async () => {
    vi.mocked(authApi.login).mockResolvedValue(sessionWithToken)
    const { wrapper, router } = await mountWithRouter(LoginView, { path: '/?redirect=//malicioso.example' })
    const replace = vi.spyOn(router, 'replace')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(replace).toHaveBeenCalledWith('/')
  })

  it('muestra el error 422 junto al campo', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(422, 'Los datos enviados no son válidos.', { email: ['Las credenciales no son correctas.'] }),
    )
    const { wrapper } = await mountWithRouter(LoginView)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#email-error').text()).toBe('Las credenciales no son correctas.')
    expect(wrapper.find('#email').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('#email').attributes('aria-describedby')).toContain('email-error')
  })

  it('muestra el bloqueo por demasiados intentos (429)', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(429, 'Demasiados intentos. Inténtalo más tarde.'))
    const { wrapper } = await mountWithRouter(LoginView)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Demasiados intentos')
  })
})

describe('ForgotPasswordView', () => {
  it('muestra la confirmación que devuelve la API', async () => {
    vi.mocked(authFeatureApi.forgotPassword).mockResolvedValue({ success: true, message: 'Si el correo está registrado, recibirás un enlace.' })
    const { wrapper } = await mountWithRouter(ForgotPasswordView)

    await wrapper.find('#email').setValue('ana@example.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(authFeatureApi.forgotPassword).toHaveBeenCalledWith('ana@example.com')
    expect(wrapper.text()).toContain('Si el correo está registrado')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})

describe('ResetPasswordView', () => {
  it('envía token y correo del enlace con la nueva contraseña', async () => {
    vi.mocked(authFeatureApi.resetPassword).mockResolvedValue({ success: true, message: 'ok' })
    const { wrapper } = await mountWithRouter(ResetPasswordView, { path: '/?token=tok123&email=ana%40example.com' })

    await wrapper.find('#password').setValue('clave-nueva-456')
    await wrapper.find('#password_confirmation').setValue('clave-nueva-456')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(authFeatureApi.resetPassword).toHaveBeenCalledWith({
      token: 'tok123',
      email: 'ana@example.com',
      password: 'clave-nueva-456',
      password_confirmation: 'clave-nueva-456',
    })
    expect(wrapper.text()).toContain('Contraseña actualizada')
  })

  it('avisa si el enlace venció', async () => {
    vi.mocked(authFeatureApi.resetPassword).mockRejectedValue(
      new ApiError(422, 'Los datos enviados no son válidos.', { token: ['El enlace no es válido o venció. Pide uno nuevo.'] }),
    )
    const { wrapper } = await mountWithRouter(ResetPasswordView, { path: '/?token=viejo&email=ana%40example.com' })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('venció')
  })

  it('avisa si el enlace está incompleto', async () => {
    const { wrapper } = await mountWithRouter(ResetPasswordView, { path: '/' })

    expect(wrapper.text()).toContain('El enlace está incompleto')
  })
})

describe('AcceptInvitationView', () => {
  const invitation: PublicInvitation = {
    email: 'luis@example.com',
    role: 'seller',
    role_label: 'Vendedor',
    company: { razon_social: 'Bodega Ana S.A.C.', nombre_comercial: 'Bodega Ana' },
    expires_at: '2026-10-01T00:00:00Z',
  }

  it('muestra la empresa y activa la cuenta', async () => {
    vi.mocked(authFeatureApi.getInvitation).mockResolvedValue(invitation)
    vi.mocked(authApi.acceptInvitation).mockResolvedValue({ ...sessionWithToken, role: 'seller' })
    const { wrapper, router } = await mountWithRouter(AcceptInvitationView, { path: '/invitacion/tok', pattern: '/invitacion/:token' })
    const replace = vi.spyOn(router, 'replace')

    expect(wrapper.text()).toContain('Bodega Ana')
    expect((wrapper.find('#email').element as HTMLInputElement).value).toBe('luis@example.com')

    await wrapper.find('#name').setValue('Luis')
    await wrapper.find('#password').setValue('clave-segura-123')
    await wrapper.find('#password_confirmation').setValue('clave-segura-123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(authApi.acceptInvitation).toHaveBeenCalledWith('tok', {
      name: 'Luis',
      password: 'clave-segura-123',
      password_confirmation: 'clave-segura-123',
    })
    expect(replace).toHaveBeenCalledWith({ name: 'home' })
  })

  it('explica que una invitación vencida o usada ya no sirve (410)', async () => {
    vi.mocked(authFeatureApi.getInvitation).mockRejectedValue(new ApiError(410, 'La invitación ya no es válida. Pide una nueva.'))
    const { wrapper } = await mountWithRouter(AcceptInvitationView, { path: '/invitacion/tok', pattern: '/invitacion/:token' })

    expect(wrapper.find('[role="alert"]').text()).toBe('La invitación ya no es válida. Pide una nueva.')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
