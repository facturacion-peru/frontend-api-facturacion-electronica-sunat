import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

import { usePrinterSettingsStore } from '../stores/printer-settings'

/*
 * Spec 015 · T022 (HU-1, esc. 5): la impresora elegida es del teléfono, no de
 * la cuenta: se guarda en `sunat.printer` y sobrevive a cerrar sesión, a
 * reiniciar la app y a que entre otro usuario.
 */
const KEY = 'sunat.printer'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => vi.restoreAllMocks())

describe('ajustes de la impresora', () => {
  it('empieza sin impresora, en 58 mm, QR nativo e «Imprimir al cobrar» apagado', () => {
    const settings = usePrinterSettingsStore()

    expect(settings.configured).toBe(false)
    expect(settings.printer).toBeNull()
    expect(settings.width).toBe(58)
    expect(settings.qr).toBe('native')
    expect(settings.autoPrint).toBe(false)
  })

  it('guarda la elección en el teléfono y la recupera al volver a abrir la app', async () => {
    const settings = usePrinterSettingsStore()
    settings.choose({ name: 'MTP-II', address: '00:11:22:33:44:55' })
    settings.width = 80
    settings.qr = 'image'
    settings.autoPrint = true
    await nextTick()

    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ address: '00:11:22:33:44:55', name: 'MTP-II', width: 80, qr: 'image', autoPrint: true })

    setActivePinia(createPinia())
    const reopened = usePrinterSettingsStore()
    expect(reopened.configured).toBe(true)
    expect(reopened.printer).toEqual({ name: 'MTP-II', address: '00:11:22:33:44:55' })
    expect(reopened.width).toBe(80)
    expect(reopened.qr).toBe('image')
    expect(reopened.autoPrint).toBe(true)
  })

  it('no depende de la sesión: la clave no lleva empresa ni usuario', async () => {
    usePrinterSettingsStore().choose({ name: 'MTP-II', address: '00:11:22:33:44:55' })
    await nextTick()

    expect(Object.keys(localStorage)).toEqual([KEY])
  })

  it('«Olvidar» quita la impresora', async () => {
    const settings = usePrinterSettingsStore()
    settings.choose({ name: 'MTP-II', address: '00:11:22:33:44:55' })
    settings.forget()
    await nextTick()

    expect(settings.configured).toBe(false)
    setActivePinia(createPinia())
    expect(usePrinterSettingsStore().configured).toBe(false)
  })

  it('con datos dañados o de otra forma, queda sin configurar', () => {
    localStorage.setItem(KEY, '{dañado')
    expect(usePrinterSettingsStore().configured).toBe(false)

    setActivePinia(createPinia())
    localStorage.setItem(KEY, JSON.stringify({ v: 1, address: 5, width: 70 }))
    const settings = usePrinterSettingsStore()
    expect(settings.configured).toBe(false)
    expect(settings.width).toBe(58)
  })

  it('si el almacenamiento falla, queda sin configurar y no rompe', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })

    const settings = usePrinterSettingsStore()
    expect(settings.configured).toBe(false)
    settings.choose({ name: 'MTP-II', address: '00:11:22:33:44:55' })
    await nextTick()
    expect(settings.configured).toBe(true)
  })
})
