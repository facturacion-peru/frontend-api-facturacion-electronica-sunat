import { afterEach, describe, expect, it, vi } from 'vitest'

import { device, initDevice } from '..'

/*
 * Spec 013 · T010: en la web el módulo de dispositivo se comporta como hasta
 * ahora (CE-004): localStorage, descargas con enlace y sin botón «Atrás».
 */
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('device (web)', () => {
  it('no es nativo y no tiene versión de app', async () => {
    await initDevice()

    expect(device().isNative).toBe(false)
    expect(device().appVersion).toBeNull()
  })

  it('secureStore usa localStorage', async () => {
    await device().secureStore.set('k', 'v')
    expect(localStorage.getItem('k')).toBe('v')
    expect(await device().secureStore.get('k')).toBe('v')

    await device().secureStore.remove('k')
    expect(await device().secureStore.get('k')).toBeNull()
  })

  it('deliverFile descarga con un enlace, o lo abre en otra pestaña', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    URL.createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:x')
    URL.revokeObjectURL = vi.fn<(url: string) => void>()
    const links: HTMLAnchorElement[] = []
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = create(tag)
      if (tag === 'a') links.push(el as HTMLAnchorElement)
      return el
    })

    await device().deliverFile(new Blob(['x']), 'B001-1.xml')
    await device().deliverFile(new Blob(['x']), 'B001-1-a4.pdf', { open: true })

    expect(click).toHaveBeenCalledTimes(2)
    expect(links[0]!.download).toBe('B001-1.xml')
    expect(links[1]!.target).toBe('_blank')
  })

  it('onBackButton no hace nada y devuelve cómo dejar de escuchar', () => {
    expect(() => device().onBackButton(() => {})()).not.toThrow()
  })

  it('onConnectionChange informa navigator.onLine y sus cambios', () => {
    const handler = vi.fn<(online: boolean) => void>()
    const stop = device().onConnectionChange(handler)
    expect(handler).toHaveBeenLastCalledWith(navigator.onLine)

    window.dispatchEvent(new Event('offline'))
    expect(handler).toHaveBeenLastCalledWith(false)
    window.dispatchEvent(new Event('online'))
    expect(handler).toHaveBeenLastCalledWith(true)

    stop()
    window.dispatchEvent(new Event('offline'))
    expect(handler).toHaveBeenCalledTimes(3)
  })
})
