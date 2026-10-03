import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/core/auth/session-store'
import type { SellableProduct } from '../api'
import { useSaleDraftStore } from '../stores/sale-draft'

/*
 * Spec 012 · T003: la venta en curso se guarda en el dispositivo por
 * empresa y usuario (A-58, RF-001 a RF-003).
 */
const galletas: SellableProduct = { id: 1, code: 'GAL-1', name: 'Galletas', type: 'good', unit: 'NIU', sale_price: '2.99', available_stock: '10.000' }
const azucar: SellableProduct = { id: 2, code: 'AZU-1', name: 'Azúcar', type: 'good', unit: 'KGM', sale_price: '4.20', available_stock: '5.000' }

/** Una «sesión» nueva de la app: Pinia nuevo con el usuario y la empresa dados. */
function boot(userId = 1, companyId = 1) {
  setActivePinia(createPinia())
  useSessionStore().session = {
    user: { id: userId, name: 'Ana', email: 'ana@demo.test' }, platform_admin: false,
    company: { id: companyId, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null }, role: 'seller',
  }
  const draft = useSaleDraftStore()
  draft.load()

  return draft
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('sale-draft', () => {
  it('RF-001 conserva toda la venta en curso al volver a abrir la app', async () => {
    const draft = boot()
    draft.add(galletas)
    draft.add(galletas)
    draft.add(azucar)
    draft.kind = '03'
    draft.seriesId = 11
    draft.paymentMethod = 'yape_plin'
    draft.customerName = 'María'
    await nextTick()

    const again = boot()
    expect(again.lines.map((l) => [l.product.name, l.quantity])).toEqual([['Galletas', '2'], ['Azúcar', '1']])
    expect([again.kind, again.seriesId, again.paymentMethod, again.customerName]).toEqual(['03', 11, 'yape_plin', 'María'])
    expect(again.idempotencyKey).toBe(draft.idempotencyKey)
    expect(again.count).toBe(2)
    expect(again.total).toBe('10.18')
  })

  it('HU-1 esc. 4 cada usuario y empresa tiene su propia venta en curso', async () => {
    boot(1, 1).add(galletas)
    await nextTick()

    expect(boot(2, 1).lines).toEqual([])
    expect(boot(1, 2).lines).toEqual([])
    expect(boot(1, 1).lines).toHaveLength(1)
  })

  it('clear vacía la venta y la borra del dispositivo, con otra clave de idempotencia', async () => {
    const draft = boot()
    draft.add(galletas)
    await nextTick()
    const key = draft.idempotencyKey

    draft.clear()
    await nextTick()

    expect(draft.lines).toEqual([])
    expect(draft.idempotencyKey).not.toBe(key)
    expect(boot().lines).toEqual([])
  })

  it('descarta datos dañados o de otra versión', () => {
    localStorage.setItem('sunat.sale-draft.1.1', '{no es json')
    expect(boot().lines).toEqual([])

    localStorage.setItem('sunat.sale-draft.1.1', JSON.stringify({ v: 99, lines: [{ product: galletas, quantity: '1' }] }))
    expect(boot().lines).toEqual([])
  })

  it('sin almacenamiento disponible funciona en memoria, sin errores', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const draft = boot()

    draft.add(galletas)
    await nextTick()
    expect(draft.lines).toHaveLength(1)
    expect(() => draft.clear()).not.toThrow()
  })

  it('RF-002 refresh actualiza precio y disponible, y quita lo que ya no se vende', async () => {
    const draft = boot()
    draft.add(galletas)
    draft.add(azucar)
    draft.add({ ...galletas, id: 3, name: 'Borrado' })

    const removed = await draft.refresh(async (id) => {
      if (id === 1) return { ...galletas, sale_price: '3.50', available_stock: '7.000', active: true }
      if (id === 2) return { ...azucar, active: false }
      throw new Error('404')
    })

    expect(removed).toEqual(['Azúcar', 'Borrado'])
    expect(draft.lines.map((l) => [l.product.name, l.product.sale_price, l.product.available_stock])).toEqual([['Galletas', '3.50', '7.000']])
  })
})
