import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { ApiError } from '@/core/api/errors'
import { getToken, setToken } from '@/core/api/token-storage'
import type { Session, SessionWithToken } from '../types'

/*
 * Spec 013 · T016, RF-003 (A-65): el panel de la plataforma no va en la app.
 * La cuenta de plataforma no entra y su token se revoca de inmediato.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('@/core/device', () => ({ device: () => ({ isNative: true, appVersion: '0.1.0' }) }))
vi.mock('../api', () => ({ authApi: { login: vi.fn<AsyncFn>(), me: vi.fn<AsyncFn>(), logout: vi.fn<AsyncFn>(), acceptInvitation: vi.fn<AsyncFn>() } }))

const { authApi } = await import('../api')
const { useSessionStore, PLATFORM_IN_APP_MESSAGE } = await import('../session-store')

const platform: Session = { user: { id: 9, name: 'Plataforma', email: 'plataforma@demo.test' }, platform_admin: true, company: null, role: null }
const seller: Session = {
  user: { id: 1, name: 'Luis', email: 'luis@demo.test' }, platform_admin: false,
  company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null }, role: 'seller',
}
const withToken = (s: Session): SessionWithToken => ({ ...s, token: '1|abc', expires_at: '2026-10-07T12:00:00Z' })

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('session-store en la app Android', () => {
  it('la cuenta de plataforma no entra: se revoca el token y se explica que use la web', async () => {
    vi.mocked(authApi.login).mockResolvedValue(withToken(platform))
    vi.mocked(authApi.logout).mockResolvedValue({} as never)
    const store = useSessionStore()

    await expect(store.login('plataforma@demo.test', 'x')).rejects.toMatchObject({ message: PLATFORM_IN_APP_MESSAGE })
    expect(PLATFORM_IN_APP_MESSAGE).toContain('web')
    expect(authApi.logout).toHaveBeenCalled()
    expect(store.session).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('al abrir la app con un token de plataforma, no se restaura la sesión', async () => {
    setToken('1|viejo')
    vi.mocked(authApi.me).mockResolvedValue(platform)
    const store = useSessionStore()

    expect(await store.restore()).toBe(false)
    expect(store.session).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('un usuario de empresa entra como siempre', async () => {
    vi.mocked(authApi.login).mockResolvedValue(withToken(seller))
    const store = useSessionStore()

    await store.login('luis@demo.test', 'x')
    expect(store.session?.role).toBe('seller')
    expect(authApi.logout).not.toHaveBeenCalled()
  })

  it('el error es un ApiError para mostrarse en el formulario', async () => {
    vi.mocked(authApi.login).mockResolvedValue(withToken(platform))
    await expect(useSessionStore().login('p', 'x')).rejects.toBeInstanceOf(ApiError)
  })
})
