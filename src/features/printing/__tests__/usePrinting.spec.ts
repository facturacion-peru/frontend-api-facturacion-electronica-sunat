import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { ApiError } from '@/core/api/errors'

/*
 * Spec 015 · T023 (HU-2, HU-3, HU-4, RF-002, RF-005, RF-008): con impresora
 * configurada, «Imprimir» pide los bytes a la API y los envía por Bluetooth;
 * sin ella, todo sigue como en las specs 003 y 013.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

const fake = vi.hoisted(() => ({
  isNative: true,
  available: true,
  print: vi.fn<AsyncFn>(),
}))

vi.mock('@/core/device', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/core/device')>()
  return {
    ...real,
    device: () => ({ isNative: fake.isNative, appVersion: null, printer: { available: fake.available, print: fake.print } }),
  }
})
vi.mock('../api', () => ({
  printingApi: { ticket: vi.fn<AsyncFn>(), document: vi.fn<AsyncFn>(), testPage: vi.fn<AsyncFn>() },
}))

const { PrinterError } = await import('@/core/device')
const { printingApi } = await import('../api')
const { usePrinting } = await import('../composables/usePrinting')
const { usePrinterSettingsStore } = await import('../stores/printer-settings')

const BYTES = new Uint8Array([0x1b, 0x40])
const ADDRESS = '00:11:22:33:44:55'

function configure() {
  const settings = usePrinterSettingsStore()
  settings.choose({ name: 'MTP-II', address: ADDRESS })
  settings.width = 80
  settings.qr = 'image'
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  Object.assign(fake, { isNative: true, available: true })
  fake.print.mockResolvedValue(undefined)
  vi.mocked(printingApi.ticket).mockResolvedValue(BYTES)
  vi.mocked(printingApi.document).mockResolvedValue(BYTES)
  vi.mocked(printingApi.testPage).mockResolvedValue(BYTES)
})

describe('con impresora configurada', () => {
  beforeEach(configure)

  it('el ticket se pide con el ancho y el modo guardados y se envía a la impresora', async () => {
    const printing = usePrinting()
    const pdf = vi.fn<() => Promise<void>>()

    await printing.printTicket(9, { pdf })

    expect(printing.direct.value).toBe(true)
    expect(printingApi.ticket).toHaveBeenCalledWith(9, { width: 80, qr: 'image' })
    expect(fake.print).toHaveBeenCalledWith(ADDRESS, BYTES)
    expect(pdf).not.toHaveBeenCalled()
    expect(printing.failure.value).toBeNull()
  })

  it('el comprobante también va directo a la impresora', async () => {
    const printing = usePrinting()

    await printing.printDocument(15, { pdf: vi.fn<() => Promise<void>>() })

    expect(printingApi.document).toHaveBeenCalledWith(15, { width: 80, qr: 'image' })
    expect(fake.print).toHaveBeenCalledWith(ADDRESS, BYTES)
  })

  it('la hoja de prueba usa lo elegido', async () => {
    await usePrinting().printTestPage()

    expect(printingApi.testPage).toHaveBeenCalledWith({ width: 80, qr: 'image' })
    expect(fake.print).toHaveBeenCalledWith(ADDRESS, BYTES)
  })

  it('mientras imprime está ocupado y no manda dos veces', async () => {
    let finish!: () => void
    fake.print.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    const printing = usePrinting()

    const first = printing.printTicket(9, { pdf: vi.fn<() => Promise<void>>() })
    await vi.waitFor(() => expect(fake.print).toHaveBeenCalled())
    expect(printing.busy.value).toBe(true)
    await printing.printTicket(9, { pdf: vi.fn<() => Promise<void>>() })
    finish()
    await first

    expect(fake.print).toHaveBeenCalledTimes(1)
    expect(printing.busy.value).toBe(false)
  })

  it('un fallo de la impresora deja el motivo, y «Reintentar» vuelve a imprimir (HU-4)', async () => {
    fake.print.mockRejectedValueOnce(new PrinterError('connect_failed'))
    const printing = usePrinting()

    await printing.printTicket(9, { pdf: vi.fn<() => Promise<void>>() })
    expect(printing.failure.value).toMatchObject({ code: 'connect_failed' })
    expect(printing.failure.value!.message).toContain('encendida')

    await printing.retry()
    expect(fake.print).toHaveBeenCalledTimes(2)
    expect(printingApi.ticket).toHaveBeenCalledTimes(2)
    expect(printing.failure.value).toBeNull()
  })

  it('«Compartir PDF» tras un fallo usa el PDF de siempre', async () => {
    fake.print.mockRejectedValueOnce(new PrinterError('write_failed'))
    const pdf = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const printing = usePrinting()

    await printing.printTicket(9, { pdf })
    await printing.sharePdf()

    expect(pdf).toHaveBeenCalledTimes(1)
    expect(printing.failure.value).toBeNull()
  })

  it('si la API no responde (sin internet), lo avisa como fallo con su mensaje', async () => {
    vi.mocked(printingApi.ticket).mockRejectedValueOnce(new ApiError(0, 'No se pudo conectar con el servidor.'))
    const printing = usePrinting()

    await printing.printTicket(9, { pdf: vi.fn<() => Promise<void>>() })

    expect(printing.failure.value).toEqual({ code: 'api', message: 'No se pudo conectar con el servidor.' })
    expect(fake.print).not.toHaveBeenCalled()
  })

  it.each([
    ['bluetooth_off', 'apagado'],
    ['not_paired', 'emparejada'],
    ['permission_denied', 'permiso'],
    ['write_failed', 'papel'],
    ['unsupported', 'no tiene Bluetooth'],
    ['unknown', 'No se pudo imprimir'],
  ] as const)('el código %s tiene su mensaje en español', async (code, text) => {
    fake.print.mockRejectedValueOnce(new PrinterError(code))
    const printing = usePrinting()

    await printing.printTicket(9, { pdf: vi.fn<() => Promise<void>>() })

    expect(printing.failure.value).toMatchObject({ code })
    expect(printing.failure.value!.message).toContain(text)
  })
})

describe('sin impresora configurada (RF-008)', () => {
  it('en la web, el ticket se imprime con el navegador', async () => {
    Object.assign(fake, { isNative: false, available: false })
    const web = vi.fn<() => void>()
    const pdf = vi.fn<() => Promise<void>>()
    const printing = usePrinting()

    await printing.printTicket(9, { pdf, web })

    expect(printing.direct.value).toBe(false)
    expect(web).toHaveBeenCalled()
    expect(pdf).not.toHaveBeenCalled()
    expect(fake.print).not.toHaveBeenCalled()
  })

  it('en la web, el comprobante abre su PDF de 80 mm', async () => {
    Object.assign(fake, { isNative: false, available: false })
    const pdf = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    await usePrinting().printDocument(15, { pdf })

    expect(pdf).toHaveBeenCalled()
  })

  it('en la app, el ticket se comparte como PDF (spec 013)', async () => {
    const web = vi.fn<() => void>()
    const pdf = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    await usePrinting().printTicket(9, { pdf, web })

    expect(pdf).toHaveBeenCalled()
    expect(web).not.toHaveBeenCalled()
    expect(printingApi.ticket).not.toHaveBeenCalled()
  })

  it('en la web no se usa la impresora aunque haya ajustes guardados', async () => {
    configure()
    Object.assign(fake, { isNative: false, available: false })
    const web = vi.fn<() => void>()

    await usePrinting().printTicket(9, { pdf: vi.fn<() => Promise<void>>(), web })

    expect(web).toHaveBeenCalled()
    expect(fake.print).not.toHaveBeenCalled()
  })

  it('si el PDF falla, deja un mensaje de error (no un fallo de impresora)', async () => {
    const pdf = vi.fn<() => Promise<void>>().mockRejectedValue(new ApiError(500, 'Error del servidor.'))
    const printing = usePrinting()

    await printing.printTicket(9, { pdf })

    expect(printing.error.value).toBe('Error del servidor.')
    expect(printing.failure.value).toBeNull()
  })
})
