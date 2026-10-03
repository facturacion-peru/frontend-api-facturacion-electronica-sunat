import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Spec 010 · HU-5 (A-55): tema claro, oscuro o del sistema, recordado en el
 * dispositivo. El estado vive en el módulo: cada prueba lo carga de nuevo.
 */
let systemDark = false
const listeners: Array<() => void> = []

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('dark') && systemDark
    },
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  }))
}

async function load() {
  vi.resetModules()
  return import('../useTheme')
}

const applied = () => document.documentElement.dataset.theme

beforeEach(() => {
  systemDark = false
  listeners.length = 0
  localStorage.clear()
  stubMatchMedia()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete document.documentElement.dataset.theme
})

describe('useTheme', () => {
  it('por defecto sigue al sistema, también cuando este cambia', async () => {
    systemDark = true
    const { initTheme, useTheme } = await load()
    initTheme()

    expect(useTheme().preference.value).toBe('system')
    expect(applied()).toBe('dark')

    systemDark = false
    listeners.forEach((fn) => fn())
    expect(applied()).toBe('light')
  })

  it('la elección se aplica al instante y se recuerda en el dispositivo', async () => {
    const first = await load()
    first.initTheme()
    first.useTheme().setPreference('dark')

    expect(applied()).toBe('dark')
    expect(localStorage.getItem('sunat.theme')).toBe('dark')

    const again = await load()
    again.initTheme()
    expect(again.useTheme().preference.value).toBe('dark')
  })

  it('una elección fija no cambia con el sistema; volver a «Sistema» olvida la elección', async () => {
    const { initTheme, useTheme } = await load()
    initTheme()
    useTheme().setPreference('light')

    systemDark = true
    listeners.forEach((fn) => fn())
    expect(applied()).toBe('light')

    useTheme().setPreference('system')
    expect(applied()).toBe('dark')
    expect(localStorage.getItem('sunat.theme')).toBeNull()
  })

  it('sin almacenamiento disponible sigue funcionando con el tema del sistema', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const { initTheme, useTheme } = await load()

    expect(() => initTheme()).not.toThrow()
    expect(() => useTheme().setPreference('dark')).not.toThrow()
    expect(applied()).toBe('dark')
  })
})
