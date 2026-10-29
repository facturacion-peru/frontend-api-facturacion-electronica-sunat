import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'

/* Spec 015 · T026 (HU-1, RF-001, RF-006): la pantalla «Impresora». */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

const printer = vi.hoisted(() => ({
  available: true,
  status: vi.fn<AsyncFn>(),
  listPaired: vi.fn<AsyncFn>(),
  print: vi.fn<AsyncFn>(),
  openSettings: vi.fn<AsyncFn>(),
  requestEnable: vi.fn<AsyncFn>(),
}))

vi.mock('@/core/device', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/core/device')>()
  return { ...real, device: () => ({ isNative: true, appVersion: '0.2.0', printer }) }
})
vi.mock('../api', () => ({ printingApi: { testPage: vi.fn<AsyncFn>(), ticket: vi.fn<AsyncFn>(), document: vi.fn<AsyncFn>() } }))

const { PrinterError } = await import('@/core/device')
const { printingApi } = await import('../api')
const PrinterView = (await import('../views/PrinterView.vue')).default
const { usePrinterSettingsStore } = await import('../stores/printer-settings')

const MTP = { name: 'MTP-II', address: '00:11:22:33:44:55' }
const HEADPHONES = { name: 'Audífonos', address: 'AA:BB:CC:DD:EE:FF' }

const button = (label: string) => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined

async function open(beforeMount?: () => void) {
  return mountWithRouter(PrinterView, { path: '/impresora', pattern: '/impresora', beforeMount })
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
  vi.clearAllMocks()
  printer.status.mockResolvedValue({ supported: true, enabled: true })
  printer.listPaired.mockResolvedValue([MTP, HEADPHONES])
  printer.print.mockResolvedValue(undefined)
  vi.mocked(printingApi.testPage).mockResolvedValue(new Uint8Array([1]))
})

describe('pantalla «Impresora»', () => {
  it('explica el permiso antes de pedirlo y luego lista las emparejadas', async () => {
    await open()

    expect(document.body.textContent).toContain('Dispositivos cercanos')
    expect(printer.listPaired).not.toHaveBeenCalled()

    button('Ver impresoras emparejadas')!.click()
    await flushPromises()

    const list = document.body.querySelector('[data-test="paired-list"]')!
    expect(list.textContent).toContain('MTP-II')
    expect(list.textContent).toContain('Audífonos')
  })

  it('al elegir una, la guarda en el teléfono y muestra las opciones', async () => {
    await open()
    button('Ver impresoras emparejadas')!.click()
    await flushPromises()

    Array.from(document.body.querySelectorAll('[data-test="paired-list"] button')).find((b) => b.textContent?.includes('MTP-II'))!.dispatchEvent(new Event('click'))
    await flushPromises()

    expect(usePrinterSettingsStore().printer).toEqual(MTP)
    expect(JSON.parse(localStorage.getItem('sunat.printer')!)).toMatchObject({ address: MTP.address })
    expect(document.body.querySelector('[data-test="chosen-printer"]')!.textContent).toContain('MTP-II')
    expect(document.body.textContent).toContain('Ancho del papel')
  })

  it('sin equipos emparejados, ofrece abrir los ajustes de Bluetooth', async () => {
    printer.listPaired.mockResolvedValue([])
    await open()
    button('Ver impresoras emparejadas')!.click()
    await flushPromises()

    expect(document.body.querySelector('[data-test="no-paired"]')).not.toBeNull()
    button('Abrir ajustes de Bluetooth')!.click()
    expect(printer.openSettings).toHaveBeenCalled()
  })

  it('si niega el permiso, explica cómo darlo y no guarda nada', async () => {
    printer.listPaired.mockRejectedValue(new PrinterError('permission_denied'))
    await open()
    button('Ver impresoras emparejadas')!.click()
    await flushPromises()

    expect(document.body.querySelector('[data-test="permission-denied"]')!.textContent).toContain('Ajustes')
    expect(usePrinterSettingsStore().configured).toBe(false)
    expect(localStorage.getItem('sunat.printer')).toBeNull()
  })

  it('sin Bluetooth en el teléfono, lo dice y no ofrece buscar', async () => {
    printer.status.mockResolvedValue({ supported: false, enabled: false })
    await open()

    expect(document.body.textContent).toContain('no tiene Bluetooth')
    expect(button('Ver impresoras emparejadas')).toBeUndefined()
  })

  it('con el Bluetooth apagado, ofrece encenderlo', async () => {
    printer.status.mockResolvedValueOnce({ supported: true, enabled: false }).mockResolvedValue({ supported: true, enabled: true })
    printer.requestEnable.mockResolvedValue(true)
    await open()
    expect(button('Ver impresoras emparejadas')).toBeUndefined()

    button('Encender Bluetooth')!.click()
    await flushPromises()

    expect(printer.requestEnable).toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('El Bluetooth está apagado')
    expect(button('Ver impresoras emparejadas')).toBeDefined()
  })

  describe('con una impresora elegida', () => {
    const configured = () => usePrinterSettingsStore().choose(MTP)

    it('las opciones cambian el ancho, el modo de QR e «Imprimir al cobrar» (apagado por defecto)', async () => {
      await open(configured)
      const settings = usePrinterSettingsStore()
      const select = document.body.querySelector<HTMLSelectElement>('#printer-width')!
      const autoPrint = document.body.querySelector<HTMLInputElement>('[data-test="auto-print"]')!
      expect(select.value).toBe('58')
      expect(autoPrint.checked).toBe(false)

      select.value = '80'
      select.dispatchEvent(new Event('change'))
      document.body.querySelector<HTMLInputElement>('[data-test="qr-image"]')!.click()
      autoPrint.click()
      await flushPromises()

      expect(settings.width).toBe(80)
      expect(settings.qr).toBe('image')
      expect(settings.autoPrint).toBe(true)
    })

    it('la hoja de prueba sale con el ancho y el modo elegidos', async () => {
      await open(() => {
        configured()
        usePrinterSettingsStore().width = 80
        usePrinterSettingsStore().qr = 'image'
      })

      button('Imprimir hoja de prueba')!.click()
      await flushPromises()

      expect(printingApi.testPage).toHaveBeenCalledWith({ width: 80, qr: 'image' })
      expect(printer.print).toHaveBeenCalledWith(MTP.address, new Uint8Array([1]))
      expect(document.body.textContent).toContain('Hoja enviada')
    })

    it('si la hoja de prueba falla, muestra el motivo sin «Compartir PDF»', async () => {
      printer.print.mockRejectedValue(new PrinterError('connect_failed'))
      await open(configured)

      button('Imprimir hoja de prueba')!.click()
      await flushPromises()

      expect(document.body.querySelector('[data-test="print-failed"]')!.textContent).toContain('encendida')
      expect(button('Compartir PDF')).toBeUndefined()
      expect(document.body.textContent).not.toContain('Hoja enviada')
    })

    it('«Olvidar» quita la impresora', async () => {
      await open(configured)

      button('Olvidar')!.click()
      await flushPromises()

      expect(usePrinterSettingsStore().configured).toBe(false)
      expect(button('Ver impresoras emparejadas')).toBeDefined()
    })
  })
})
