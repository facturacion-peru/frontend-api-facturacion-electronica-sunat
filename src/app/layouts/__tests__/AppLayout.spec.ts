import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/core/auth/session-store'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import AppLayout from '../AppLayout.vue'

/*
 * Spec 010 · HU-6: barra lateral. En jsdom no hay matchMedia, así que el
 * layout se comporta como en el celular: el panel empieza cerrado.
 */
async function mountLayout(path = '/') {
  const result = await mountWithRouter(AppLayout, {
    path,
    pattern: '/:rest(.*)*',
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Ana Pérez', email: 'ana@demo.test' }, platform_admin: false,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo S.A.C.', nombre_comercial: 'Bodega Demo' }, role: 'company_admin',
      }
    },
  })
  const toggle = result.wrapper.get('[aria-controls="app-sidebar"]')
  const sidebar = result.wrapper.get('#app-sidebar')

  return { ...result, toggle, sidebar }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('AppLayout', () => {
  it('la barra lateral tiene empresa, usuario, rol, tema y cerrar sesión', async () => {
    const { sidebar } = await mountLayout()

    expect(sidebar.text()).toContain('Bodega Demo')
    expect(sidebar.text()).toContain('Ana Pérez')
    expect(sidebar.text()).toContain('Administrador')
    expect(sidebar.find('[aria-label^="Tema:"]').exists()).toBe(true)
    expect(sidebar.text()).toContain('Cerrar sesión')
  })

  it('en el celular el panel empieza cerrado e inerte: sus enlaces no reciben foco', async () => {
    const { toggle, sidebar } = await mountLayout()

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(sidebar.attributes('inert')).toBeDefined()
  })

  it('el botón abre el panel; Escape lo cierra y devuelve el foco al botón', async () => {
    const { toggle, sidebar } = await mountLayout()

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(sidebar.attributes('inert')).toBeUndefined()

    await sidebar.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle.element)
  })

  it('tocar fuera o navegar cierra el panel', async () => {
    const { wrapper, toggle, router } = await mountLayout()

    await toggle.trigger('click')
    await wrapper.get('[data-test="sidebar-backdrop"]').trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    await router.push('/productos')
    await flushPromises()
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('cerrar sesión termina la sesión y lleva al inicio de sesión', async () => {
    const { sidebar, router } = await mountLayout()
    const logout = vi.spyOn(useSessionStore(), 'logout').mockResolvedValue()

    await sidebar.findAll('button').find((b) => b.text().includes('Cerrar sesión'))!.trigger('click')
    await flushPromises()

    expect(logout).toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('login')
  })
})
