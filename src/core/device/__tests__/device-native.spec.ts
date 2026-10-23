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
  // Plugin propio de la spec 015 (android/…/printer/BluetoothPrinterPlugin.java).
  printer: {
    checkPermissions: vi.fn<AsyncFn>(),
    requestPermissions: vi.fn<AsyncFn>(),
    status: vi.fn<AsyncFn>(),
    listPaired: vi.fn<AsyncFn>(),
    print: vi.fn<AsyncFn>(),
    openSettings: vi.fn<AsyncFn>(),
    requestEnable: vi.fn<AsyncFn>(),
  },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: (name: string) => (name === 'BluetoothPrinter' ? plugins.printer : undefined),
}))
vi.mock('@aparajita/capacitor-secure-storage', () => ({ SecureStorage: plugins.secure }))
vi.mock('@capacitor/app', () => ({ App: plugins.app }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: plugins.filesystem, Directory: { Cache: 'CACHE' } }))
vi.mock('@capacitor/share', () => ({ Share: plugins.share }))
vi.mock('@capacitor/network', () => ({ Network: plugins.network }))

const { device, initDevice, PrinterError } = await import('..')

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
  Object.values(plugins.printer).forEach((fn) => fn.mockReset())
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

  describe('impresora Bluetooth (spec 015)', () => {
    it('está disponible y consulta el estado del Bluetooth', async () => {
      plugins.printer.status.mockResolvedValue({ supported: true, enabled: false })

      expect(device().printer.available).toBe(true)
      expect(await device().printer.status()).toEqual({ supported: true, enabled: false })
    })

    it('lista las impresoras emparejadas si ya hay permiso, sin pedirlo', async () => {
      plugins.printer.checkPermissions.mockResolvedValue({ bluetooth: 'granted' })
      plugins.printer.listPaired.mockResolvedValue({ devices: [{ name: 'MTP-II', address: '00:11:22:33:44:55' }] })

      expect(await device().printer.listPaired()).toEqual([{ name: 'MTP-II', address: '00:11:22:33:44:55' }])
      expect(plugins.printer.requestPermissions).not.toHaveBeenCalled()
    })

    it('pide el permiso si falta antes de listar (RF-006)', async () => {
      plugins.printer.checkPermissions.mockResolvedValue({ bluetooth: 'prompt' })
      plugins.printer.requestPermissions.mockResolvedValue({ bluetooth: 'granted' })
      plugins.printer.listPaired.mockResolvedValue({ devices: [] })

      expect(await device().printer.listPaired()).toEqual([])
      expect(plugins.printer.requestPermissions).toHaveBeenCalled()
    })

    it('si se niega el permiso, lanza PrinterError permission_denied y no lista', async () => {
      plugins.printer.checkPermissions.mockResolvedValue({ bluetooth: 'prompt' })
      plugins.printer.requestPermissions.mockResolvedValue({ bluetooth: 'denied' })

      const error = await device().printer.listPaired().catch((e: unknown) => e)

      expect(error).toBeInstanceOf(PrinterError)
      expect((error as InstanceType<typeof PrinterError>).code).toBe('permission_denied')
      expect(plugins.printer.listPaired).not.toHaveBeenCalled()
    })

    it('envía los bytes en base64 a la dirección elegida', async () => {
      plugins.printer.print.mockResolvedValue(undefined)
      const bytes = new Uint8Array([0x1b, 0x40, 0xa4, 0x00, 0xff, 0x0a])

      await device().printer.print('00:11:22:33:44:55', bytes)

      expect(plugins.printer.print).toHaveBeenCalledWith({ address: '00:11:22:33:44:55', data: 'G0CkAP8K' })
    })

    it('convierte bien un envío grande a base64', async () => {
      plugins.printer.print.mockResolvedValue(undefined)
      const bytes = new Uint8Array(100_000).map((_, i) => i % 256)

      await device().printer.print('00:11:22:33:44:55', bytes)

      const sent = (plugins.printer.print.mock.calls[0]![0] as { data: string }).data
      expect(Uint8Array.from(atob(sent), (c) => c.charCodeAt(0))).toEqual(bytes)
    })

    it.each(['bluetooth_off', 'not_paired', 'connect_failed', 'write_failed', 'unsupported'])(
      'un rechazo %s del plugin llega como PrinterError con su código',
      async (code) => {
        plugins.printer.print.mockRejectedValue(Object.assign(new Error('falló'), { code }))

        const error = await device().printer.print('00:11:22:33:44:55', new Uint8Array([1])).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(PrinterError)
        expect((error as InstanceType<typeof PrinterError>).code).toBe(code)
      },
    )

    it('un rechazo sin código conocido llega como unknown', async () => {
      plugins.printer.print.mockRejectedValue(new Error('raro'))

      const error = await device().printer.print('00:11:22:33:44:55', new Uint8Array([1])).catch((e: unknown) => e)

      expect((error as InstanceType<typeof PrinterError>).code).toBe('unknown')
    })

    it('abre los ajustes de Bluetooth y pide encenderlo', async () => {
      plugins.printer.requestEnable.mockResolvedValue({ enabled: true })

      await device().printer.openSettings()
      expect(await device().printer.requestEnable()).toBe(true)
      expect(plugins.printer.openSettings).toHaveBeenCalled()
    })
  })
})
