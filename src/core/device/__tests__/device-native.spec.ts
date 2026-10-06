import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Spec 013 · T010: en Android el módulo usa los plugins de Capacitor
 * (simulados aquí): Keystore para secretos, «Compartir» para archivos,
 * botón «Atrás» y versión instalada.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

const plugins = vi.hoisted(() => ({
  secure: { getItem: vi.fn<AsyncFn>(), setItem: vi.fn<AsyncFn>(), removeItem: vi.fn<AsyncFn>(), setKeyPrefix: vi.fn<AsyncFn>() },
  app: { getInfo: vi.fn<AsyncFn>(), addListener: vi.fn<(event: string, handler: () => void) => Promise<{ remove: () => void }>>(), minimizeApp: vi.fn<AsyncFn>() },
  filesystem: { writeFile: vi.fn<AsyncFn>() },
  share: { share: vi.fn<AsyncFn>() },
  network: { getStatus: vi.fn<AsyncFn>(), addListener: vi.fn<(event: string, handler: (s: { connected: boolean }) => void) => Promise<{ remove: () => void }>>() },
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@aparajita/capacitor-secure-storage', () => ({ SecureStorage: plugins.secure }))
vi.mock('@capacitor/app', () => ({ App: plugins.app }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: plugins.filesystem, Directory: { Cache: 'CACHE' } }))
vi.mock('@capacitor/share', () => ({ Share: plugins.share }))
vi.mock('@capacitor/network', () => ({ Network: plugins.network }))

const { device, initDevice } = await import('..')

beforeAll(async () => {
  plugins.app.getInfo.mockResolvedValue({ version: '0.1.0', build: '1' })
  await initDevice()
})

beforeEach(() => {
  plugins.secure.getItem.mockReset()
  plugins.secure.setItem.mockReset()
  plugins.secure.removeItem.mockReset()
  plugins.filesystem.writeFile.mockReset()
  plugins.share.share.mockReset()
  localStorage.clear()
})

describe('device (Android)', () => {
  it('es nativo y conoce la versión instalada', () => {
    expect(device().isNative).toBe(true)
    expect(device().appVersion).toBe('0.1.0')
  })

  it('secureStore usa el almacén seguro y nunca localStorage', async () => {
    plugins.secure.getItem.mockResolvedValue('tok')

    await device().secureStore.set('sunat.auth.token', 'tok')
    expect(await device().secureStore.get('sunat.auth.token')).toBe('tok')
    await device().secureStore.remove('sunat.auth.token')

    expect(plugins.secure.setItem).toHaveBeenCalledWith('sunat.auth.token', 'tok')
    expect(plugins.secure.removeItem).toHaveBeenCalledWith('sunat.auth.token')
    expect(localStorage.length).toBe(0)
  })

  it('deliverFile guarda el archivo en la caché y abre «Compartir»', async () => {
    plugins.filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/T-000009-80mm.pdf' })

    await device().deliverFile(new Blob(['%PDF']), 'T-000009-80mm.pdf', { open: true })

    expect(plugins.filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'T-000009-80mm.pdf', directory: 'CACHE', data: expect.any(String) }))
    expect(plugins.share.share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file:///cache/T-000009-80mm.pdf'] }))
  })

  it('cancelar «Compartir» no es un error', async () => {
    plugins.filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/x.pdf' })
    plugins.share.share.mockRejectedValue(new Error('Share canceled'))

    await expect(device().deliverFile(new Blob(['x']), 'x.pdf')).resolves.toBeUndefined()
  })

  it('onBackButton escucha el botón de Android y se puede dejar de escuchar', async () => {
    const remove = vi.fn<() => void>()
    plugins.app.addListener.mockResolvedValue({ remove })
    const handler = vi.fn<() => void>()

    const stop = device().onBackButton(handler)
    plugins.app.addListener.mock.calls[0]![1]()
    stop()
    await Promise.resolve()

    expect(plugins.app.addListener).toHaveBeenCalledWith('backButton', expect.any(Function))
    expect(handler).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
  })

  it('minimize manda la app al fondo', async () => {
    await device().minimize()
    expect(plugins.app.minimizeApp).toHaveBeenCalled()
  })

  it('onConnectionChange usa el estado de red de Android (el WebView no actualiza navigator.onLine)', async () => {
    const remove = vi.fn<() => void>()
    plugins.network.getStatus.mockResolvedValue({ connected: false })
    plugins.network.addListener.mockResolvedValue({ remove })
    const handler = vi.fn<(online: boolean) => void>()

    const stop = device().onConnectionChange(handler)
    await Promise.resolve()
    await Promise.resolve()
    expect(handler).toHaveBeenLastCalledWith(false)

    plugins.network.addListener.mock.calls[0]![1]({ connected: true })
    expect(handler).toHaveBeenLastCalledWith(true)

    stop()
    await Promise.resolve()
    expect(remove).toHaveBeenCalled()
  })
})
