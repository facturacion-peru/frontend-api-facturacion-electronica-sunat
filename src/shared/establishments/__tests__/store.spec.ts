import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompanyRole } from '@/core/auth/types'
import { useSessionStore } from '@/core/auth/session-store'
import type { Establishment } from '../types'

const list = vi.hoisted(() => vi.fn<(includeInactive?: boolean) => Promise<Establishment[]>>())
vi.mock('../api', () => ({ establishmentsApi: { list } }))

const { useEstablishmentStore } = await import('../store')

/*
 * Spec 017 · F003: el local donde se trabaja (HU-2, esc. 1, 2 y 5; A-87).
 * Se recuerda en el dispositivo por empresa y usuario, y con un solo local
 * activo en la empresa no hay nada que elegir ni mostrar (RF-010).
 */
const principal: Establishment = {
  id: 1, code: '0000', name: 'Principal', address: 'Av. Lima 123', ubigeo: '150101', district: 'Lima / Lima / Lima', is_main: true, active: true, code_locked: true,
}
const sucursal: Establishment = { ...principal, id: 2, code: '0001', name: 'Sucursal Centro', is_main: false, code_locked: false }
const cerrado: Establishment = { ...principal, id: 3, code: '0002', name: 'Cerrado', is_main: false, active: false }
const norte: Establishment = { ...principal, id: 4, code: '0003', name: 'Norte', is_main: false }

/** Una «sesión» nueva de la app: Pinia nuevo con lo que trae la API. */
function boot({
  establishments = [principal, sucursal],
  activeCount = 2,
  userId = 1,
  companyId = 1,
  role = 'seller' as CompanyRole,
} = {}) {
  setActivePinia(createPinia())
  useSessionStore().session = {
    user: { id: userId, name: 'Ana', email: 'ana@demo.test' },
    platform_admin: false,
    company: { id: companyId, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null, logo_url: null, active_establishments_count: activeCount },
    role,
    establishments,
  }

  return useEstablishmentStore()
}

const key = (companyId = 1, userId = 1) => `sunat.establishment.${companyId}.${userId}`

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('local actual', () => {
  it('RF-010: con un solo local activo en la empresa no hay selector y se usa ese', () => {
    const store = boot({ establishments: [principal], activeCount: 1 })

    expect(store.multi).toBe(false)
    expect(store.current).toEqual(principal)
    expect(store.needsChoice).toBe(false)
  })

  it('HU-2 esc. 1: el vendedor con un local en una empresa con varios ve su local, sin elegir', () => {
    const store = boot({ establishments: [sucursal], activeCount: 2 })

    expect(store.multi).toBe(true)
    expect(store.allowed).toEqual([sucursal])
    expect(store.current).toEqual(sucursal)
    expect(store.needsChoice).toBe(false)
  })

  it('HU-2 esc. 2: con varios locales hay que elegir, y la elección se recuerda en el dispositivo', async () => {
    const store = boot()
    expect(store.current).toBeNull()
    expect(store.needsChoice).toBe(true)

    store.choose(sucursal.id)
    await nextTick()
    expect(store.current).toEqual(sucursal)
    expect(JSON.parse(localStorage.getItem(key())!)).toMatchObject({ id: sucursal.id })

    expect(boot().current).toEqual(sucursal)
  })

  it('la elección es de cada usuario y de cada empresa', async () => {
    boot().choose(sucursal.id)
    await nextTick()

    expect(boot({ userId: 2 }).current).toBeNull()
    expect(boot({ companyId: 2 }).current).toBeNull()
    expect(boot().current).toEqual(sucursal)
  })

  it('HU-2 esc. 5: si el local recordado ya no está permitido o activo, pide elegir otro', async () => {
    boot().choose(sucursal.id)
    await nextTick()

    const store = boot({ establishments: [principal, { ...sucursal, active: false }, norte], activeCount: 2 })
    expect(store.current).toBeNull()
    expect(store.needsChoice).toBe(true)
    expect(store.allowed).toEqual([principal, norte])

    // Si solo queda uno permitido, se trabaja en ese sin preguntar.
    expect(boot({ establishments: [principal, cerrado], activeCount: 2 }).current).toEqual(principal)
  })

  it('no deja elegir un local que no está permitido', () => {
    const store = boot()

    store.choose(cerrado.id)
    expect(store.current).toBeNull()
    expect(localStorage.getItem(key())).toBeNull()
  })

  it('setAllowed refresca los locales (GET /establishments) y revisa el actual', async () => {
    const store = boot()
    store.choose(sucursal.id)
    await nextTick()

    store.setAllowed([principal, { ...sucursal, active: false }])
    expect(store.allowed).toEqual([principal])
    expect(store.current).toEqual(principal)
  })

  it('caso límite: el vendedor sin locales activos no puede trabajar', () => {
    const store = boot({ establishments: [], activeCount: 2 })

    expect(store.noneAllowed).toBe(true)
    expect(store.current).toBeNull()
    expect(store.needsChoice).toBe(false)
  })

  it('dañado, de otra versión o sin almacenamiento: se pide elegir y luego funciona en memoria', async () => {
    localStorage.setItem(key(), '{dañado')
    expect(boot().current).toBeNull()

    localStorage.setItem(key(), JSON.stringify({ v: 99, id: sucursal.id }))
    expect(boot().current).toBeNull()

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const store = boot()
    store.choose(sucursal.id)
    await nextTick()
    expect(store.current).toEqual(sucursal)
  })

  it('cerrar sesión no borra la elección: es del dispositivo', async () => {
    const store = boot()
    store.choose(sucursal.id)
    await nextTick()

    useSessionStore().session = null
    await nextTick()
    expect(store.current).toBeNull()
    expect(localStorage.getItem(key())).not.toBeNull()
    expect(boot().current).toEqual(sucursal)
  })

  it('reload: el administrador que crea el segundo local pasa a ver selector y filtros', async () => {
    const store = boot({ establishments: [principal], activeCount: 1, role: 'company_admin' })
    expect(store.multi).toBe(false)

    list.mockResolvedValue([principal, sucursal, cerrado])
    await store.reload()
    await flushPromises()

    expect(list).toHaveBeenCalledWith(true)
    expect(store.multi).toBe(true)
    expect(store.allowed).toEqual([principal, sucursal])
    expect(store.filterOptions).toEqual([principal, sucursal, cerrado])
  })

  it('reload del vendedor solo refresca sus locales', async () => {
    const store = boot({ establishments: [principal, sucursal], activeCount: 3 })
    list.mockResolvedValue([sucursal])

    await store.reload()

    expect(list).toHaveBeenCalledWith(false)
    expect(store.allowed).toEqual([sucursal])
    expect(store.multi).toBe(true)
  })
})
