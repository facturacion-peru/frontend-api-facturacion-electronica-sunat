import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompanyRole } from '@/core/auth/types'
import { useSessionStore } from '@/core/auth/session-store'
const list = vi.hoisted(() => vi.fn<(includeInactive?: boolean) => Promise<unknown[]>>())
vi.mock('../api', () => ({ establishmentsApi: { list } }))

const { default: EstablishmentFilter } = await import('../EstablishmentFilter.vue')
import { useEstablishmentStore } from '../store'
import type { Establishment } from '../types'

/*
 * Spec 017 · F006: filtro de local (HU-4, A-90 y RF-010).
 */
const principal: Establishment = {
  id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123', ubigeo: '150101', district: 'Lima / Lima / Lima', is_main: true, active: true, code_locked: true,
}
const sucursal: Establishment = { ...principal, id: 2, code: '0001', name: 'Sucursal Centro', is_main: false }
const cerrado: Establishment = { ...principal, id: 3, code: '0002', name: 'Cerrado', is_main: false, active: false }

function boot(establishments: Establishment[], activeCount: number, role: CompanyRole = 'company_admin') {
  useSessionStore().session = {
    user: { id: 1, name: 'Ana', email: 'ana@demo.test' },
    platform_admin: false,
    company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null, active_establishments_count: activeCount },
    role,
    establishments,
  }
  return useEstablishmentStore()
}

function mountFilter(modelValue: number | null = null) {
  const wrapper = mount(EstablishmentFilter, {
    props: { id: 'f', modelValue, 'onUpdate:modelValue': (v: number | null) => wrapper.setProps({ modelValue: v }) },
  })
  return wrapper
}

beforeEach(() => {
  list.mockReset().mockResolvedValue([])
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('EstablishmentFilter', () => {
  it('RF-010: con un solo local activo no se pinta', () => {
    boot([principal], 1)
    expect(mountFilter().find('select').exists()).toBe(false)
  })

  it('«Todos los locales» es null y elegir un local emite su id', async () => {
    boot([principal, sucursal], 2)
    const filter = mountFilter()

    expect(filter.findAll('option').map((o) => o.text())).toEqual(['Todos los locales', 'Principal', 'Sucursal Centro'])
    await filter.get('select').setValue(String(sucursal.id))
    expect(filter.emitted('update:modelValue')).toEqual([[sucursal.id]])
    expect(filter.emitted('change')).toEqual([[sucursal.id]])

    await filter.get('select').setValue(filter.findAll('option')[0]!.element.value)
    expect(filter.emitted('change')).toEqual([[sucursal.id], [null]])
  })

  it('el administrador ve también los inactivos, por su historial (una sola petición)', async () => {
    list.mockResolvedValue([principal, sucursal, cerrado])
    boot([principal, sucursal], 2)

    const filter = mountFilter()
    mountFilter()
    await flushPromises()

    expect(filter.findAll('option').map((o) => o.text())).toContain('Cerrado (inactivo)')
    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith(true)
  })

  it('el vendedor no pide inactivos: ve sus locales de la sesión', async () => {
    boot([principal, sucursal], 2, 'seller')
    mountFilter()
    await flushPromises()

    expect(list).not.toHaveBeenCalled()
  })

  it('A-87: empieza en «Todos» para el administrador y en el local actual para el vendedor', () => {
    expect(boot([principal, sucursal], 2).defaultFilter).toBeNull()

    setActivePinia(createPinia())
    const seller = boot([principal, sucursal], 2, 'seller')
    seller.choose(sucursal.id)
    expect(seller.defaultFilter).toBe(sucursal.id)
  })
})
