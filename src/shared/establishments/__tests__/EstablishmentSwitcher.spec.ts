import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@/core/auth/session-store'
import { dismissTop } from '@/shared/ui/dismissable'
import EstablishmentSwitcher from '../EstablishmentSwitcher.vue'
import { useEstablishmentStore } from '../store'
import type { Establishment } from '../types'

/*
 * Spec 017 · F005: elegir el local donde se trabaja (HU-2, esc. 1 y 2; RF-010).
 */
const principal: Establishment = {
  id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123', ubigeo: '150101', district: 'Lima / Lima / Lima', is_main: true, active: true, code_locked: true,
}
const sucursal: Establishment = { ...principal, id: 2, code: '0001', name: 'Sucursal Centro', address: 'Jr. Unión 45', is_main: false }

let wrapper: VueWrapper | undefined

function mountSwitcher(establishments: Establishment[], activeCount: number, props: Record<string, unknown> = {}) {
  useSessionStore().session = {
    user: { id: 1, name: 'Ana', email: 'ana@demo.test' },
    platform_admin: false,
    company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null, logo_url: null, active_establishments_count: activeCount },
    role: 'company_admin',
    establishments,
  }
  wrapper = mount(EstablishmentSwitcher, { props, attachTo: document.body })
  return wrapper
}

const dialogText = () => document.querySelector('[role="dialog"]')?.textContent ?? null

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('EstablishmentSwitcher', () => {
  it('RF-010: con un solo local activo en la empresa no se pinta', () => {
    expect(mountSwitcher([principal], 1).html()).not.toContain('Principal')
  })

  it('HU-2 esc. 1: con un solo local permitido muestra su nombre, sin botón', () => {
    const switcher = mountSwitcher([sucursal], 2)

    expect(switcher.get('[data-test="establishment-name"]').text()).toContain('Sucursal Centro')
    expect(switcher.find('button').exists()).toBe(false)
  })

  it('HU-2 esc. 2: con varios abre la lista, con el actual enfocado, y elegir cambia el local', async () => {
    const switcher = mountSwitcher([principal, sucursal], 2)
    useEstablishmentStore().choose(principal.id)
    await nextTick()

    expect(switcher.get('[data-test="establishment-switcher"]').text()).toContain('Principal')
    await switcher.get('[data-test="establishment-switcher"]').trigger('click')
    await nextTick()
    await nextTick()

    expect(dialogText()).toContain('¿En qué local trabajas?')
    const current = document.querySelector<HTMLButtonElement>('[data-test="pick-establishment-1"]')!
    expect(current.getAttribute('aria-current')).toBe('true')
    expect(document.activeElement).toBe(current)

    document.querySelector<HTMLButtonElement>('[data-test="pick-establishment-2"]')!.click()
    await nextTick()

    expect(useEstablishmentStore().current?.id).toBe(sucursal.id)
    expect(switcher.emitted('changed')).toEqual([[sucursal.id]])
    expect(dialogText()).toBeNull()
  })

  it('sin local elegido dice «Elegir local», y open() abre la lista', async () => {
    const switcher = mountSwitcher([principal, sucursal], 2)

    expect(switcher.text()).toContain('Elegir local')
    ;(switcher.vm as unknown as { open: () => void }).open()
    await nextTick()
    expect(dialogText()).toContain('Sucursal Centro')
  })

  it('con una venta abierta avisa que queda guardada en el local actual', async () => {
    const switcher = mountSwitcher([principal, sucursal], 2, { draftCount: 3 })
    useEstablishmentStore().choose(principal.id)
    await nextTick()

    await switcher.get('[data-test="establishment-switcher"]').trigger('click')
    await nextTick()

    expect(document.querySelector('[data-test="draft-kept"]')!.textContent).toContain('Tu venta en curso (3 productos) queda guardada en Principal.')
  })

  it('«Atrás» cierra la lista sin cambiar de local', async () => {
    const switcher = mountSwitcher([principal, sucursal], 2)
    useEstablishmentStore().choose(principal.id)
    await nextTick()

    await switcher.get('[data-test="establishment-switcher"]').trigger('click')
    await nextTick()
    expect(dismissTop()).toBe(true)
    await nextTick()

    expect(dialogText()).toBeNull()
    expect(useEstablishmentStore().current?.id).toBe(principal.id)
    expect(switcher.emitted('changed')).toBeUndefined()
  })

  it('contraído conserva un nombre accesible', async () => {
    const switcher = mountSwitcher([principal, sucursal], 2, { collapsed: true })
    useEstablishmentStore().choose(sucursal.id)
    await nextTick()

    expect(switcher.get('[data-test="establishment-switcher"]').attributes('aria-label')).toBe('Local: Sucursal Centro. Cambiar')
  })
})
