import { afterEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/core/auth/session-store'
import type { CompanyRole } from '@/core/auth/types'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import MainNav from '../MainNav.vue'

/*
 * Navegación de la barra lateral (spec 010, HU-6). Sustituye al menú «Más»
 * de la spec 002: en la barra lateral hay altura para todas las entradas.
 */
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
    expect(wrapper.text()).not.toContain('Gestión')
  })

  it('el administrador ve además el grupo «Gestión», sin menús escondidos', async () => {
    const { wrapper } = await mountAs('company_admin')
    const group = wrapper.get('[aria-labelledby="nav-admin"]')

    expect(wrapper.get('#nav-admin').text()).toBe('Gestión')
    expect(group.findAll('a').map((a) => a.text())).toEqual(['Alertas', 'Clientes', 'Usuarios', 'Auditoría', 'Mi empresa', 'SUNAT', 'Series', 'Importar y exportar'])
    expect(group.isVisible()).toBe(true)
  })

  it('marca «Ventas» también en las pantallas de comprobantes y detalles', async () => {
    const { wrapper } = await mountAs('seller', '/ventas/comprobantes/5')

    const current = wrapper.findAll('a').filter((a) => a.attributes('aria-current') === 'page').map((a) => a.text())
    expect(current).toEqual(['Ventas'])
  })

  it('marca la entrada de gestión activa', async () => {
    const { wrapper } = await mountAs('company_admin', '/series')

    const current = wrapper.findAll('a').filter((a) => a.attributes('aria-current') === 'page').map((a) => a.text())
    expect(current).toEqual(['Series'])
  })
})
