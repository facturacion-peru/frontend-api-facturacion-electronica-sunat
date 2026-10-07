import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { setToken } from '@/core/api/token-storage'
import type { Session } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  authApi: { login: vi.fn<AsyncFn>(), me: vi.fn<AsyncFn>(), logout: vi.fn<AsyncFn>(), acceptInvitation: vi.fn<AsyncFn>() },
}))

const { authApi } = await import('../api')
const { authGuard, safeRedirect } = await import('../guards')

const Stub = { template: '<div />' }

const seller: Session = {
  user: { id: 2, name: 'Luis', email: 'luis@example.com' },
  platform_admin: false,
  company: { id: 7, ruc: '20131312955', razon_social: 'Bodega Ana S.A.C.', nombre_comercial: null },
  role: 'seller',
}

function makeRouter(): Router {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub, meta: { requiresAuth: true } },
      { path: '/login', name: 'login', component: Stub, meta: { guestOnly: true } },
      { path: '/usuarios', name: 'users', component: Stub, meta: { requiresAuth: true, roles: ['company_admin'] } },
      { path: '/plataforma', name: 'platform-companies', component: Stub, meta: { requiresAuth: true, platform: true } },
      { path: '/invitacion/:token', name: 'accept-invitation', component: Stub, meta: { public: true } },
    ],
  })
  router.beforeEach(authGuard)

  return router
}

describe('authGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('lleva al login con la ruta de retorno si no hay sesión', async () => {
    const router = makeRouter()

    await router.push('/usuarios?pagina=2')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/usuarios?pagina=2')
  })

  it('al abrir el inicio sin sesión, el login no dice que la sesión terminó (spec 013)', async () => {
    const router = makeRouter()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBeUndefined()
  })

  it('recupera la sesión guardada antes de decidir', async () => {
    setToken('1|abc')
    vi.mocked(authApi.me).mockResolvedValue(seller)
    const router = makeRouter()

    await router.push('/')

    expect(authApi.me).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('saca del login a quien ya tiene sesión', async () => {
    setToken('1|abc')
    vi.mocked(authApi.me).mockResolvedValue(seller)
    const router = makeRouter()

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('bloquea al vendedor en rutas de administrador', async () => {
    setToken('1|abc')
    vi.mocked(authApi.me).mockResolvedValue(seller)
    const router = makeRouter()

    await router.push('/usuarios')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('permite al administrador de empresa las rutas de administrador', async () => {
    setToken('1|abc')
    vi.mocked(authApi.me).mockResolvedValue({ ...seller, role: 'company_admin' })
    const router = makeRouter()

    await router.push('/usuarios')

    expect(router.currentRoute.value.name).toBe('users')
  })

  it('lleva al administrador de la plataforma a su panel y no lo deja en la app de empresa (A-35)', async () => {
    setToken('1|abc')
    vi.mocked(authApi.me).mockResolvedValue({ ...seller, platform_admin: true, company: null, role: null })
    const router = makeRouter()

    await router.push('/')
    expect(router.currentRoute.value.name).toBe('platform-companies')

    await router.push('/usuarios')
    expect(router.currentRoute.value.name).toBe('platform-companies')
  })

  it('un usuario de empresa no entra al panel de la plataforma', async () => {
    setToken('1|abc')
    vi.mocked(authApi.me).mockResolvedValue({ ...seller, role: 'company_admin' })
    const router = makeRouter()

    await router.push('/plataforma')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('las rutas públicas no exigen sesión', async () => {
    const router = makeRouter()

    await router.push('/invitacion/abc')

    expect(router.currentRoute.value.name).toBe('accept-invitation')
    expect(authApi.me).not.toHaveBeenCalled()
  })
})

describe('safeRedirect', () => {
  it('acepta rutas internas y rechaza destinos externos', () => {
    expect(safeRedirect('/usuarios?pagina=2')).toBe('/usuarios?pagina=2')
    expect(safeRedirect('//malicioso.example')).toBe('/')
    expect(safeRedirect('https://malicioso.example')).toBe('/')
    expect(safeRedirect(undefined)).toBe('/')
    expect(safeRedirect(['/a'])).toBe('/')
  })
})
