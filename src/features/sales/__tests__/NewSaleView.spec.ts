import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import type { PaginatedResponse } from '@/core/api/types'
import { useSessionStore } from '@/core/auth/session-store'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SellableProduct } from '../api'
import type { Customer, IssuingAvailability, SalesDocument, Ticket } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  salesApi: { listProducts: vi.fn<AsyncFn>(), getProduct: vi.fn<AsyncFn>(), issue: vi.fn<AsyncFn>() },
  salesDocumentsApi: { availability: vi.fn<AsyncFn>(), issue: vi.fn<AsyncFn>(), download: vi.fn<AsyncFn>() },
  customersApi: { search: vi.fn<AsyncFn>(), create: vi.fn<AsyncFn>() },
}))

const { salesApi, salesDocumentsApi, customersApi } = await import('../api')
const NewSaleView = (await import('../views/NewSaleView.vue')).default

const galletas: SellableProduct = { id: 1, code: 'GAL-1', name: 'Galletas', type: 'good', unit: 'NIU', sale_price: '2.99', available_stock: '10.000' }
const azucar: SellableProduct = { id: 2, code: 'AZU-1', name: 'Azúcar', type: 'good', unit: 'KGM', sale_price: '4.20', available_stock: '5.000' }
const agotado: SellableProduct = { id: 3, code: 'AGO-1', name: 'Agotado', type: 'good', unit: 'NIU', sale_price: '1.00', available_stock: '0.000' }

const ticket: Ticket = {
  id: 9, number: 9, display_number: 'T-000009', status: 'issued', legal_notice: 'Documento interno — no es comprobante de pago',
  seller: { id: 2, name: 'Luis' }, customer_name: null, customer_label: 'Cliente varios', customer_document: null,
  payment_method: 'yape_plin', subtotal: '2.99', discount_total: '0.00', total: '2.99', issued_at: '2026-10-03T15:00:00Z',
  voided_at: null, void_reason: null,
  lines: [{ product_id: 1, product_code: 'GAL-1', product_name: 'Galletas', unit: 'NIU', quantity: '1.000', unit_price: '2.99', gross_amount: '2.99', discount: '0.00', amount: '2.99' }],
}

/** Comprobante emitido, como lo devuelve la API (solo lo que usa la confirmación). */
const boleta = (over: Partial<SalesDocument> = {}) =>
  ({ id: 31, document_type: '03', display_number: 'B001-00000151', total: '2.99', status: 'accepted', next_attempt_at: null, discard_reason: null, ...over }) as SalesDocument

/** El modal se monta en <body> (Teleport). */
const dialog = () => document.body.querySelector('[role="dialog"]') as HTMLElement | null
const dialogButton = (label: string) => Array.from(dialog()!.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

const available: IssuingAvailability = {
  can_issue: true,
  status_label: 'Validada',
  series: [
    { id: 11, document_type: '03', code: 'B001', active: true },
    { id: 12, document_type: '01', code: 'F001', active: true },
  ],
}
const ferreteria: Customer = { id: 5, document_type: '6', document_type_label: 'RUC', document_number: '20100070970', name: 'FERRETERIA EL SOL S.A.C.', address: null }

const page = (data: SellableProduct[], current = 1, last = 1): PaginatedResponse<SellableProduct> => ({
  success: true, data, meta: { current_page: current, last_page: last, per_page: 20, total: data.length, from: 1, to: data.length },
})

/** Escritorio (dos columnas) o celular (barra y hoja), según el ancho simulado. */
function viewport(desktop: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: desktop && query.includes('min-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  viewport(true)
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(salesApi.listProducts).mockResolvedValue(page([galletas, azucar, agotado]))
  vi.mocked(salesApi.getProduct).mockImplementation(async (id) => ({ ...[galletas, azucar, agotado].find((p) => p.id === id)!, active: true }))
  vi.mocked(salesDocumentsApi.availability).mockResolvedValue(available)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

/** Monta «Vender» con sesión: la venta en curso se guarda por empresa y usuario. */
function mountSale() {
  return mountWithRouter(NewSaleView, {
    beforeMount: () => {
      useSessionStore().session = {
        user: { id: 1, name: 'Luis', email: 'luis@demo.test' }, platform_admin: false,
        company: { id: 1, ruc: '20600000011', razon_social: 'Demo', nombre_comercial: null }, role: 'seller',
      }
    },
  })
}

const card = (wrapper: VueWrapper, name: string) => wrapper.findAll('[data-test="catalog"] button').find((b) => b.text().includes(name))!

async function addProducts(wrapper: VueWrapper, names: string[]) {
  for (const name of names) await card(wrapper, name).trigger('click')
}

const chargeButton = (wrapper: VueWrapper, label = 'Cobrar') => wrapper.findAll('button').find((b) => b.text() === label)!

describe('NewSaleView', () => {
  it('agrega productos, ajusta cantidades y muestra la vista previa del total', async () => {
    const { wrapper } = await mountSale()

    await addProducts(wrapper, ['Galletas', 'Azúcar'])
    await wrapper.findAll('[data-test="cart-line"]')[0]!.find('button[aria-label^="Agregar"]').trigger('click')
    await wrapper.findAll('[data-test="cart-line"]')[0]!.find('button[aria-label^="Agregar"]').trigger('click')
    await wrapper.find('#disc-1').setValue('0.97')
    await wrapper.find('#qty-2').setValue('0.375')

    expect(wrapper.find('[data-test="sale-total"]').text()).toMatch(/9\.58/) // 8.00 + 1.58
  })

  it('A-57 muestra el catálogo sin buscar; sin disponible no se puede agregar', async () => {
    const { wrapper } = await mountSale()

    expect(salesApi.listProducts).toHaveBeenCalledWith({ search: '', page: 1 })
    expect(wrapper.findAll('[data-test="catalog"] button')).toHaveLength(3)
    expect(card(wrapper, 'Agotado').attributes('disabled')).toBeDefined()
    expect(card(wrapper, 'Agotado').text()).toContain('Sin disponible')
  })

  it('HU-3 la búsqueda filtra el catálogo y «Cargar más» trae la página siguiente', async () => {
    vi.mocked(salesApi.listProducts).mockResolvedValueOnce(page([galletas], 1, 2)).mockResolvedValueOnce(page([azucar], 2, 2))
    const { wrapper } = await mountSale()

    await wrapper.get('[data-test="catalog-more"]').trigger('click')
    await flushPromises()
    expect(salesApi.listProducts).toHaveBeenLastCalledWith({ search: '', page: 2 })
    expect(wrapper.findAll('[data-test="catalog"] button').map((b) => b.text())).toEqual([expect.stringContaining('Galletas'), expect.stringContaining('Azúcar')])

    vi.mocked(salesApi.listProducts).mockResolvedValue(page([azucar]))
    await wrapper.find('#sale-search').setValue('azu')
    await wrapper.find('#sale-search').trigger('input')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(salesApi.listProducts).toHaveBeenLastCalledWith({ search: 'azu', page: 1 })
  })

  it('HU-3 esc. 4 tocar otra vez suma uno y la tarjeta dice cuántos llevo', async () => {
    const { wrapper } = await mountSale()

    await addProducts(wrapper, ['Galletas', 'Galletas'])

    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(1)
    expect((wrapper.find('#qty-1').element as HTMLInputElement).value).toBe('2')
    expect(card(wrapper, 'Galletas').text()).toContain('En el carrito: 2')
  })

  it('CE-001 la venta en curso sigue ahí al salir y volver a «Vender», con precios al día', async () => {
    const first = await mountSale()
    await addProducts(first.wrapper, ['Galletas', 'Azúcar'])
    await first.wrapper.find('input[value="yape_plin"]').setValue(true)
    first.wrapper.unmount()

    vi.mocked(salesApi.getProduct).mockImplementation(async (id) => (id === 1 ? { ...galletas, sale_price: '3.00', active: true } : { ...azucar, active: true }))
    const { wrapper } = await mountSale()

    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(2)
    expect((wrapper.find('input[value="yape_plin"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.find('[data-test="sale-total"]').text()).toMatch(/7\.20/) // 3.00 + 4.20
  })

  it('RF-002 al volver quita los productos que ya no se venden y avisa', async () => {
    const first = await mountSale()
    await addProducts(first.wrapper, ['Galletas', 'Azúcar'])
    first.wrapper.unmount()

    vi.mocked(salesApi.getProduct).mockImplementation(async (id) => ({ ...(id === 1 ? galletas : azucar), active: id === 1 }))
    const { wrapper } = await mountSale()

    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Se quitó del carrito: Azúcar')
  })

  it('HU-2 «Vaciar carrito» pide confirmación; cancelar no cambia nada', async () => {
    const { wrapper } = await mountSale()
    expect(wrapper.find('[data-test="clear-cart"]').exists()).toBe(false)
    await addProducts(wrapper, ['Galletas', 'Azúcar'])

    await wrapper.get('[data-test="clear-cart"]').trigger('click')
    const dialog = () => document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog().textContent).toContain('Se quitarán 2 productos')

    ;(Array.from(dialog().querySelectorAll('button')).find((b) => b.textContent?.includes('Cancelar')) as HTMLButtonElement).click()
    await flushPromises()
    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(2)

    await wrapper.get('[data-test="clear-cart"]').trigger('click')
    ;(Array.from(dialog().querySelectorAll('button')).find((b) => b.textContent?.includes('Vaciar')) as HTMLButtonElement).click()
    await flushPromises()
    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(0)
    expect(localStorage.getItem('sunat.sale-draft.1.1')).toBeNull()
  })

  it('v1.2 el selector de tipo y el aviso de pruebas están dentro del carrito', async () => {
    const { wrapper } = await mountSale()
    await addProducts(wrapper, ['Galletas'])
    const cart = wrapper.get('section[aria-labelledby="cart-title"]')

    expect(cart.find('[data-test="sale-kind"]').exists()).toBe(true)
    await cart.findAll('[data-test="sale-kind"] label').find((l) => l.text() === 'Boleta')!.find('input').setValue(true)
    expect(cart.find('[data-test="environment-badge"]').exists()).toBe(true)
  })

  it('v1.3 el carrito sigue el orden del cobro: productos, qué emitir, cliente, medio de pago', async () => {
    const { wrapper } = await mountSale()
    const cart = () => wrapper.get('section[aria-labelledby="cart-title"]')
    expect(cart().find('[data-test="sale-kind"]').exists()).toBe(false) // vacío: solo la invitación

    await addProducts(wrapper, ['Galletas'])
    const html = cart().html()
    const at = (needle: string) => html.indexOf(needle)

    expect(at('data-test="cart-line"')).toBeGreaterThan(-1)
    expect(at('data-test="cart-line"')).toBeLessThan(at('data-test="sale-kind"'))
    expect(at('data-test="sale-kind"')).toBeLessThan(at('aria-controls="sale-customer"'))
    expect(at('aria-controls="sale-customer"')).toBeLessThan(at('name="payment-method"'))
  })

  it('HU-4 en el celular, una barra con cantidad y total abre el carrito', async () => {
    viewport(false)
    const { wrapper } = await mountSale()
    expect(wrapper.find('[data-test="cart-bar"]').exists()).toBe(false)

    await addProducts(wrapper, ['Galletas', 'Azúcar'])
    const bar = wrapper.get('[data-test="cart-bar"]')
    expect(bar.text()).toContain('Ticket · 2 productos')
    expect(bar.text()).toMatch(/7\.19/)
    expect(wrapper.find('[data-test="cart-line"]').exists()).toBe(false)

    await bar.get('button').trigger('click')
    expect(document.body.querySelectorAll('[role="dialog"] [data-test="cart-line"]')).toHaveLength(2)
  })

  it('v1.4 cobra, se queda en «Vender» y confirma en un modal con número y total', async () => {
    vi.mocked(salesApi.issue).mockResolvedValue(ticket)
    const { wrapper, router } = await mountSale()
    const push = vi.spyOn(router, 'push')

    await addProducts(wrapper, ['Galletas'])
    await wrapper.find('input[value="yape_plin"]').setValue(true)
    await chargeButton(wrapper).trigger('click')
    await flushPromises()

    expect(salesApi.issue).toHaveBeenCalledWith(expect.objectContaining({
      payment_method: 'yape_plin',
      lines: [{ product_id: 1, quantity: '1' }],
      idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }))
    expect(push).not.toHaveBeenCalled()
    expect(dialog()!.textContent).toContain('Venta registrada')
    expect(dialog()!.textContent).toContain('T-000009')
    expect(dialog()!.textContent).toMatch(/2\.99/)
    expect(wrapper.findAll('[data-test="cart-line"]')).toHaveLength(0)
    expect(localStorage.getItem('sunat.sale-draft.1.1')).toBeNull()
    // El catálogo se recarga: el disponible ya descuenta lo vendido.
    expect(salesApi.listProducts).toHaveBeenCalledTimes(2)
  })

  it('v1.4 «Nueva venta» cierra el modal y deja el foco en la búsqueda', async () => {
    vi.mocked(salesApi.issue).mockResolvedValue(ticket)
    const { wrapper } = await mountSale()
    await addProducts(wrapper, ['Galletas'])
    await chargeButton(wrapper).trigger('click')
    await flushPromises()

    expect(document.activeElement).toBe(dialogButton('Nueva venta'))
    dialogButton('Nueva venta').click()
    await flushPromises()

    expect(dialog()).toBeNull()
    expect(document.activeElement?.id).toBe('sale-search')
  })

  it('v1.4 imprime el ticket y lleva al detalle si se pide', async () => {
    vi.mocked(salesApi.issue).mockResolvedValue(ticket)
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { wrapper, router } = await mountSale()
    await addProducts(wrapper, ['Galletas'])
    await chargeButton(wrapper).trigger('click')
    await flushPromises()

    dialogButton('Imprimir').click()
    await flushPromises()
    expect(print).toHaveBeenCalled()

    dialogButton('Ver detalle').click()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('ticket-detail')
    expect(router.currentRoute.value.params.id).toBe('9')
  })

  it('reintenta con la misma clave si la conexión falla, también tras salir y volver', async () => {
    vi.mocked(salesApi.issue).mockRejectedValueOnce(new ApiError(0, 'No se pudo conectar con el servidor.')).mockResolvedValueOnce(ticket)
    const first = await mountSale()
    await addProducts(first.wrapper, ['Galletas'])

    await chargeButton(first.wrapper).trigger('click')
    await flushPromises()
    expect(first.wrapper.text()).toContain('No se pudo conectar')
    first.wrapper.unmount()

    const { wrapper } = await mountSale()
    await chargeButton(wrapper).trigger('click')
    await flushPromises()

    const [firstKey, secondKey] = vi.mocked(salesApi.issue).mock.calls.map((call) => (call[0] as { idempotency_key: string }).idempotency_key)
    expect(secondKey).toBe(firstKey)
  })

  it('marca la línea sin stock suficiente con el disponible de la API', async () => {
    vi.mocked(salesApi.issue).mockRejectedValue(
      new ApiError(422, 'Stock insuficiente', { quantity: ['Solo hay 5.000 disponible de Azúcar.'] }, { available: '5.000', product_id: 2 }),
    )
    const { wrapper } = await mountSale()
    await addProducts(wrapper, ['Galletas', 'Azúcar'])

    await wrapper.findAll('button').find((b) => b.text() === 'Cobrar')!.trigger('click')
    await flushPromises()

    const lines = wrapper.findAll('[data-test="cart-line"]')
    expect(lines[1]!.text()).toContain('Solo hay 5 disponible.')
    expect(lines[0]!.find('[role="alert"]').exists()).toBe(false)
  })

  it('ubica los errores de validación en su línea', async () => {
    vi.mocked(salesApi.issue).mockRejectedValue(new ApiError(422, 'x', { 'lines.0.discount': ['El descuento no puede superar el importe de la línea (2.99).'] }))
    const { wrapper } = await mountSale()
    await addProducts(wrapper, ['Galletas'])

    await wrapper.findAll('button').find((b) => b.text() === 'Cobrar')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="cart-line"]').text()).toContain('El descuento no puede superar')
  })

  describe('boleta y factura (spec 005)', () => {
    async function choose(wrapper: VueWrapper, label: string) {
      const input = wrapper.findAll('[data-test="sale-kind"] label').find((l) => l.text() === label)!.find('input')
      await input.setValue(true)
    }

    it('emite una boleta a Cliente varios y la confirma con el resultado de SUNAT', async () => {
      vi.mocked(salesDocumentsApi.issue).mockResolvedValue(boleta())
      const { wrapper, router } = await mountSale()
      await addProducts(wrapper, ['Galletas'])

      await choose(wrapper, 'Boleta')
      expect(wrapper.find('[data-test="environment-badge"]').exists()).toBe(true)
      await chargeButton(wrapper, 'Emitir boleta · B001').trigger('click')
      await flushPromises()

      expect(salesDocumentsApi.issue).toHaveBeenCalledWith(expect.objectContaining({
        document_type: '03', series_id: 11, customer_id: null, payment_method: 'cash', lines: [{ product_id: 1, quantity: '1' }],
      }))
      expect(router.currentRoute.value.name).not.toBe('sales-document-detail')
      expect(dialog()!.textContent).toContain('B001-00000151')
      expect(dialog()!.textContent).toContain('SUNAT aceptó el comprobante.')

      dialogButton('Imprimir').click()
      await flushPromises()
      expect(salesDocumentsApi.download).toHaveBeenCalledWith(expect.objectContaining({ id: 31 }), '80mm')
    })

    it('v1.4 destaca si SUNAT no respondió o rechazó el comprobante', async () => {
      vi.mocked(salesDocumentsApi.issue).mockResolvedValue(boleta({ status: 'pending', next_attempt_at: '2026-10-03T15:01:00Z' }))
      const { wrapper } = await mountSale()
      await addProducts(wrapper, ['Galletas'])
      await choose(wrapper, 'Boleta')
      await chargeButton(wrapper, 'Emitir boleta · B001').trigger('click')
      await flushPromises()

      expect(dialog()!.querySelector('[role="status"], [role="alert"]')!.textContent).toContain('SUNAT no respondió')
    })

    it('la factura exige un cliente con RUC', async () => {
      vi.mocked(customersApi.search).mockResolvedValue([ferreteria])
      vi.mocked(salesDocumentsApi.issue).mockResolvedValue({ id: 32 } as SalesDocument)
      const { wrapper } = await mountSale()
      await addProducts(wrapper, ['Galletas'])
      await choose(wrapper, 'Factura')

      const emit = () => wrapper.findAll('button').find((b) => b.text() === 'Emitir factura · F001')!
      expect(emit().attributes('disabled')).toBeDefined()

      await wrapper.find('#customer-search').setValue('ferre')
      await wrapper.find('#customer-search').trigger('input')
      vi.advanceTimersByTime(300)
      await flushPromises()
      await wrapper.find('[data-test="customer-results"] button').trigger('click')
      await emit().trigger('click')
      await flushPromises()

      expect(salesDocumentsApi.issue).toHaveBeenCalledWith(expect.objectContaining({ document_type: '01', series_id: 12, customer_id: 5 }))
    })

    it('avisa y bloquea la boleta de más de S/ 700 sin comprador', async () => {
      const { wrapper } = await mountSale()
      await addProducts(wrapper, ['Galletas'])
      await wrapper.find('#qty-1').setValue('300') // 897.00
      await choose(wrapper, 'Boleta')

      expect(wrapper.find('[data-test="receipt-limit"]').text()).toContain('S/ 700')
      expect(wrapper.findAll('button').find((b) => b.text() === 'Emitir boleta · B001')!.attributes('disabled')).toBeDefined()
    })

    it('sin emisión SUNAT disponible solo deja el ticket, y dice por qué', async () => {
      vi.mocked(salesDocumentsApi.availability).mockResolvedValue({ ...available, can_issue: false, status_label: 'Pendiente de validación' })
      const { wrapper } = await mountSale()
      await addProducts(wrapper, ['Galletas'])

      const inputs = wrapper.findAll('[data-test="sale-kind"] input')
      expect(inputs.map((i) => i.attributes('disabled') !== undefined)).toEqual([false, true, true])
      expect(wrapper.find('[data-test="kind-blocked"]').text()).toContain('Pendiente de validación')
    })

    it('con varias series del tipo deja elegir', async () => {
      vi.mocked(salesDocumentsApi.availability).mockResolvedValue({
        ...available, series: [...available.series, { id: 13, document_type: '03', code: 'B002', active: true }],
      })
      vi.mocked(salesDocumentsApi.issue).mockResolvedValue({ id: 33 } as SalesDocument)
      const { wrapper } = await mountSale()
      await addProducts(wrapper, ['Galletas'])
      await choose(wrapper, 'Boleta')

      await wrapper.find('#sale-series').setValue(13)
      await wrapper.findAll('button').find((b) => b.text() === 'Emitir boleta · B002')!.trigger('click')
      await flushPromises()

      expect(salesDocumentsApi.issue).toHaveBeenCalledWith(expect.objectContaining({ series_id: 13 }))
    })

    it('muestra el error de la API (p. ej. configuración no validada)', async () => {
      vi.mocked(salesDocumentsApi.issue).mockRejectedValue(new ApiError(422, 'x', { sunat: ['La emisión SUNAT no está disponible: Con error.'] }))
      const { wrapper } = await mountSale()
      await addProducts(wrapper, ['Galletas'])
      await choose(wrapper, 'Boleta')

      await wrapper.findAll('button').find((b) => b.text() === 'Emitir boleta · B001')!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('La emisión SUNAT no está disponible: Con error.')
    })

    describe('comprobante recordado (v1.5, A-60)', () => {
      const withB002: IssuingAvailability = { ...available, series: [...available.series, { id: 13, document_type: '03', code: 'B002', active: true }] }
      const preference = () => JSON.parse(localStorage.getItem('sunat.sale-preference.1.1') ?? 'null')

      it('HU-6 esc. 1 y CE-004 tras emitir una boleta B002, la siguiente venta ya la tiene elegida', async () => {
        vi.mocked(salesDocumentsApi.availability).mockResolvedValue(withB002)
        vi.mocked(salesDocumentsApi.issue).mockResolvedValue(boleta({ display_number: 'B002-00000001' }))
        const first = await mountSale()
        await addProducts(first.wrapper, ['Galletas'])
        await choose(first.wrapper, 'Boleta')
        await first.wrapper.find('#sale-series').setValue(13)
        await first.wrapper.find('input[value="card"]').setValue(true)
        await chargeButton(first.wrapper, 'Emitir boleta · B002').trigger('click')
        await flushPromises()
        dialogButton('Nueva venta').click()
        await flushPromises()

        await addProducts(first.wrapper, ['Azúcar'])
        expect(chargeButton(first.wrapper, 'Emitir boleta · B002').exists()).toBe(true)
        expect((first.wrapper.find('input[value="cash"]').element as HTMLInputElement).checked).toBe(true)
        first.wrapper.unmount()
        document.body.innerHTML = ''

        // Otra sesión de la app (p. ej. tras cerrar sesión y volver a entrar).
        localStorage.removeItem('sunat.sale-draft.1.1')
        const { wrapper } = await mountSale()
        await addProducts(wrapper, ['Galletas'])
        await chargeButton(wrapper, 'Emitir boleta · B002').trigger('click')
        await flushPromises()
        expect(salesDocumentsApi.issue).toHaveBeenLastCalledWith(expect.objectContaining({ document_type: '03', series_id: 13 }))
      })

      it('HU-6 esc. 2 y 3 lo elegido se recuerda aunque no se cobre y al vaciar el carrito', async () => {
        const first = await mountSale()
        await addProducts(first.wrapper, ['Galletas'])
        await choose(first.wrapper, 'Factura')
        await first.wrapper.get('[data-test="clear-cart"]').trigger('click')
        dialogButton('Vaciar carrito').click()
        await flushPromises()
        first.wrapper.unmount()

        const { wrapper } = await mountSale()
        await addProducts(wrapper, ['Galletas'])
        expect(wrapper.findAll('button').some((b) => b.text() === 'Emitir factura · F001')).toBe(true)
      })

      it('RF-010 serie recordada inactiva: usa la serie por defecto sin olvidar la preferencia', async () => {
        localStorage.setItem('sunat.sale-preference.1.1', JSON.stringify({ v: 1, kind: '03', seriesId: 99 }))
        const { wrapper } = await mountSale()
        await addProducts(wrapper, ['Galletas'])

        expect(chargeButton(wrapper, 'Emitir boleta · B001').exists()).toBe(true)
        expect(preference()).toMatchObject({ kind: '03', seriesId: 99 })
      })

      it('RF-010 sin SUNAT disponible vuelve a ticket, y la boleta sigue recordada para cuando vuelva', async () => {
        localStorage.setItem('sunat.sale-preference.1.1', JSON.stringify({ v: 1, kind: '03', seriesId: 11 }))
        vi.mocked(salesDocumentsApi.availability).mockRejectedValue(new Error('red'))
        const { wrapper } = await mountSale()
        await addProducts(wrapper, ['Galletas'])

        expect(chargeButton(wrapper).exists()).toBe(true)
        expect(preference()).toMatchObject({ kind: '03', seriesId: 11 })
      })

      it('RF-011 la barra del celular dice el comprobante y la serie', async () => {
        viewport(false)
        localStorage.setItem('sunat.sale-preference.1.1', JSON.stringify({ v: 1, kind: '03', seriesId: 11 }))
        const { wrapper } = await mountSale()
        await addProducts(wrapper, ['Galletas'])

        expect(wrapper.get('[data-test="cart-bar"]').text()).toContain('Boleta B001 · 1 producto')
      })
    })
  })
})
