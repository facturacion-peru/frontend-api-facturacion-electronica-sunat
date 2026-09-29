import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { useSessionStore } from '@/core/auth/session-store'
import type { CompanyRole } from '@/core/auth/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import MainNav from '../MainNav.vue'

async function mountAs(role: CompanyRole, path = '/') {
  return mountWithRouter(MainNav, {
    path,
    pattern: '/:rest(.*)*',
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Ana', email: 'ana@demo.test' }, platform_admin: false,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null }, role,
      }
    },
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('MainNav', () => {
  it('el vendedor ve solo las entradas del día a día', async () => {
    const { wrapper } = await mountAs('seller')

    expect(wrapper.findAll('a').map((a) => a.text())).toEqual(['Inicio', 'Vender', 'Ventas', 'Productos'])
    expect(wrapper.find('[aria-controls="nav-more"]').exists()).toBe(false)
  })

  it('el administrador abre «Más» con la gestión de la empresa', async () => {
    const { wrapper } = await mountAs('company_admin')
    const toggle = wrapper.find('[aria-controls="nav-more"]')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#nav-more').isVisible()).toBe(false)

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#nav-more').text()).toContain('Usuarios')
    expect(wrapper.find('#nav-more').text()).toContain('Mi empresa')
    expect(wrapper.find('#nav-more').text()).toContain('SUNAT')
    expect(wrapper.find('#nav-more').text()).toContain('Series')
    expect(wrapper.find('#nav-more').text()).toContain('Clientes')
  })

  it('Escape cierra el menú y devuelve el foco al botón', async () => {
    const { wrapper } = await mountAs('company_admin')
    const toggle = wrapper.find('[aria-controls="nav-more"]')

    await toggle.trigger('click')
    await wrapper.find('#nav-more a').trigger('keydown', { key: 'Escape' })
    await flushPromises()

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle.element)
  })

  it('marca «Ventas» también en las pantallas de comprobantes y detalles', async () => {
    const { wrapper } = await mountAs('seller', '/ventas/comprobantes/5')

    const current = wrapper.findAll('a').filter((a) => a.attributes('aria-current') === 'page').map((a) => a.text())
    expect(current).toEqual(['Ventas'])
  })
})
