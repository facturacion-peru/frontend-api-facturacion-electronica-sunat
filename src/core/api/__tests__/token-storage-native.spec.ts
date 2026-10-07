import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Spec 013 · T010, HU-2: en la app el token vive en el almacén seguro; el
 * cliente HTTP lo lee de una copia en memoria cargada al arrancar.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

const store = vi.hoisted(() => ({ get: vi.fn<AsyncFn>(), set: vi.fn<AsyncFn>(), remove: vi.fn<AsyncFn>() }))

vi.mock('@/core/device', () => ({ device: () => ({ isNative: true, secureStore: store }) }))

const { clearToken, getToken, initTokenStorage, onTokenCleared, setToken } = await import('../token-storage')

beforeEach(() => {
  localStorage.clear()
  store.set.mockResolvedValue(undefined)
  store.remove.mockResolvedValue(undefined)
})

describe('token-storage (Android)', () => {
  it('initTokenStorage carga el token guardado en el almacén seguro', async () => {
    store.get.mockResolvedValue('guardado')

    await initTokenStorage()

    expect(store.get).toHaveBeenCalledWith('sunat.auth.token')
    expect(getToken()).toBe('guardado')
  })

  it('setToken y clearToken escriben en el almacén seguro, nunca en localStorage', async () => {
    const cleared = vi.fn<() => void>()
    onTokenCleared(cleared)

    setToken('nuevo')
    expect(getToken()).toBe('nuevo')
    expect(store.set).toHaveBeenCalledWith('sunat.auth.token', 'nuevo')

    clearToken()
    expect(getToken()).toBeNull()
    expect(store.remove).toHaveBeenCalledWith('sunat.auth.token')
    expect(cleared).toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('si el almacén seguro falla al leer, se arranca sin sesión', async () => {
    store.get.mockRejectedValue(new Error('keystore'))

    await initTokenStorage()
    expect(getToken()).toBeNull()
  })
})
