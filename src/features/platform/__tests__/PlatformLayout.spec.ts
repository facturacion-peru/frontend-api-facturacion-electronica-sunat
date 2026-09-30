import { afterEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/core/auth/session-store'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import PlatformLayout from '../components/PlatformLayout.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PlatformLayout', () => {
  it('tiene su propia navegación, sin el menú de las empresas', async () => {
    const { wrapper } = await mountWithRouter(PlatformLayout, {
      path: '/plataforma/soporte',
      pattern: '/plataforma/:rest(.*)*',
      beforeMount: () => {
        useSessionStore().session = { user: { id: 1, name: 'Raúl', email: 'r@plataforma.pe' }, platform_admin: true, company: null, role: null }
      },
    })

    // El montaje de prueba vuelve a pintar el layout en su RouterView: basta la primera navegación.
    const links = wrapper.findAll('nav[aria-label="Plataforma"]')[0]!.findAll('a')
    expect(links.map((a) => a.text())).toEqual(['Empresas', 'Soporte', 'Auditoría'])
    expect(links.filter((a) => a.attributes('aria-current') === 'page').map((a) => a.text())).toEqual(['Soporte'])
    expect(wrapper.text()).not.toContain('Vender')
    expect(wrapper.text()).toContain('Raúl')
  })
})
