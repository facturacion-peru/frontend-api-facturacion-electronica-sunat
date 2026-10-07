import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Spec 013 · T016, HU-5 (A-67): la app envía su versión; si la API responde
 * 426, se pide actualizar sin borrar la sesión (la venta en curso tampoco).
 */
const version = vi.hoisted(() => ({ value: '0.1.0' as string | null }))
vi.mock('@/core/device', () => ({ device: () => ({ isNative: version.value !== null, appVersion: version.value }) }))
vi.mock('@/core/config/env', () => ({ env: { apiBaseUrl: 'http://api.test', appName: 'Prueba' } }))

// openapi-fetch toma fetch al crear el cliente: se delega antes de importarlo.
const fetchMock = vi.hoisted(() => vi.fn<(request: Request) => Promise<Response>>())
vi.stubGlobal('fetch', (request: Request) => fetchMock(request))

const { apiClient } = await import('../client')
const { updateRequired } = await import('../app-update')
const { getToken, setToken } = await import('../token-storage')

let requests: Request[] = []
function respond(status: number, body: unknown) {
  fetchMock.mockImplementation(async (request: Request) => {
    requests.push(request)
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
}

beforeEach(() => {
  requests = []
  updateRequired.value = null
  localStorage.clear()
})

describe('versión de la app', () => {
  it('la app envía X-App-Version en cada petición', async () => {
    version.value = '0.1.0'
    respond(200, { success: true, data: {} })

    await apiClient.GET('/api/v1/auth/me')
    expect(requests[0]!.headers.get('X-App-Version')).toBe('0.1.0')
  })

  it('la web no envía la cabecera', async () => {
    version.value = null
    respond(200, { success: true, data: {} })

    await apiClient.GET('/api/v1/auth/me')
    expect(requests[0]!.headers.has('X-App-Version')).toBe(false)
  })

  it('un 426 pide actualizar con la versión mínima y no borra la sesión', async () => {
    version.value = '0.1.0'
    setToken('1|abc')
    respond(426, { success: false, message: 'Actualízala', min_version: '0.3.0' })

    await apiClient.GET('/api/v1/auth/me')
    expect(updateRequired.value).toBe('0.3.0')
    expect(getToken()).toBe('1|abc')
  })
})
