import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { ApiError } from '@/core/api/errors'
import { clearToken, getToken, setToken } from '@/core/api/token-storage'
import type { Session, SessionWithToken } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  authApi: {
    login: vi.fn<AsyncFn>(),
    me: vi.fn<AsyncFn>(),
    logout: vi.fn<AsyncFn>(),
    acceptInvitation: vi.fn<AsyncFn>(),
  },
}))

const { authApi } = await import('../api')
const { useSessionStore } = await import('../session-store')

const session: Session = {
  user: { id: 1, name: 'Ana', email: 'ana@example.com' },
  platform_admin: false,
  company: { id: 7, ruc: '20131312955', razon_social: 'Bodega Ana S.A.C.', nombre_comercial: 'Bodega Ana' },
  role: 'company_admin',
}

const withToken: SessionWithToken = { ...session, token: '1|abc', expires_at: '2026-09-29T12:00:00Z' }

describe('session-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('login guarda el token y la sesión', async () => {
    vi.mocked(authApi.login).mockResolvedValue(withToken)
    const store = useSessionStore()

    await store.login('ana@example.com', 'clave-segura-123')

    expect(authApi.login).toHaveBeenCalledWith('ana@example.com', 'clave-segura-123')
    expect(getToken()).toBe('1|abc')
    expect(store.isAuthenticated).toBe(true)
    expect(store.session?.company?.id).toBe(7)
    expect(store.isCompanyAdmin).toBe(true)
  })

  it('un login fallido propaga el error y no deja sesión', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(422, 'Los datos enviados no son válidos.', { email: ['Las credenciales no son correctas.'] }),
    )
    const store = useSessionStore()

    await expect(store.login('ana@example.com', 'mala')).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('aceptar una invitación inicia la sesión', async () => {
    vi.mocked(authApi.acceptInvitation).mockResolvedValue(withToken)
    const store = useSessionStore()

    await store.acceptInvitation('tok', { name: 'Ana', password: 'x', password_confirmation: 'x' })

    expect(getToken()).toBe('1|abc')
    expect(store.isAuthenticated).toBe(true)
  })

  it('logout limpia token y sesión aunque la API falle', async () => {
    vi.mocked(authApi.login).mockResolvedValue(withToken)
    vi.mocked(authApi.logout).mockRejectedValue(new Error('sin red'))
    const store = useSessionStore()
    await store.login('ana@example.com', 'clave-segura-123')

    await store.logout()

    expect(authApi.logout).toHaveBeenCalled()
    expect(getToken()).toBeNull()
    expect(store.session).toBeNull()
  })

  it('restore recupera la sesión con el token guardado al recargar', async () => {
    setToken('1|abc')
    vi.mocked(authApi.me).mockResolvedValue(session)
    const store = useSessionStore()

    expect(await store.restore()).toBe(true)
    expect(store.session?.user.email).toBe('ana@example.com')
  })

  it('restore sin token no llama a la API', async () => {
    const store = useSessionStore()

    expect(await store.restore()).toBe(false)
    expect(authApi.me).not.toHaveBeenCalled()
  })

  it('restore con un token caducado limpia todo', async () => {
    setToken('1|viejo')
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, 'No autenticado.'))
    const store = useSessionStore()

    expect(await store.restore()).toBe(false)
    expect(getToken()).toBeNull()
    expect(store.session).toBeNull()
  })

  it('un 401 en cualquier petición (token borrado) limpia la sesión', async () => {
    vi.mocked(authApi.login).mockResolvedValue(withToken)
    const store = useSessionStore()
    await store.login('ana@example.com', 'clave-segura-123')

    clearToken()

    expect(store.session).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})
