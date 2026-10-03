import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Spec 010 · HU-5 (RF-010): el selector alterna Sistema → Claro → Oscuro y
 * dice cuál está activo.
 */
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {} }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.theme
})

describe('ThemeToggle', () => {
  it('alterna los tres temas y lo anuncia', async () => {
    vi.resetModules()
    const ThemeToggle = (await import('../ThemeToggle.vue')).default
    const button = mount(ThemeToggle).get('button')

    expect(button.attributes('aria-label')).toBe('Tema: según el sistema. Cambiar tema')

    await button.trigger('click')
    expect(button.attributes('aria-label')).toBe('Tema: claro. Cambiar tema')
    expect(document.documentElement.dataset.theme).toBe('light')

    await button.trigger('click')
    expect(button.attributes('aria-label')).toBe('Tema: oscuro. Cambiar tema')
    expect(document.documentElement.dataset.theme).toBe('dark')

    await button.trigger('click')
    expect(button.attributes('aria-label')).toBe('Tema: según el sistema. Cambiar tema')
  })
})
