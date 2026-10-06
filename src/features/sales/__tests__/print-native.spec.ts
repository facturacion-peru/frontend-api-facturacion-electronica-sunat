import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Ticket } from '../types'

/*
 * Spec 013 · T012, A-63: en la app Android no hay impresión del navegador.
 * «Imprimir» pide el PDF de 80 mm del ticket a la API y lo comparte.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('@/core/device', () => ({ device: () => ({ isNative: true, appVersion: '0.1.0' }) }))
vi.mock('../api', () => ({
  salesApi: { get: vi.fn<AsyncFn>(), void: vi.fn<AsyncFn>(), ticketPdf: vi.fn<AsyncFn>() },
  salesDocumentsApi: { download: vi.fn<AsyncFn>() },
}))

const { salesApi } = await import('../api')
const TicketView = (await import('../views/TicketView.vue')).default
const SaleDoneDialog = (await import('../components/SaleDoneDialog.vue')).default

const ticket = {
  id: 9, number: 9, display_number: 'T-000009', status: 'issued', legal_notice: 'Documento interno — no es comprobante de pago',
  seller: null, customer_name: null, customer_label: 'Cliente varios', customer_document: null, payment_method: 'cash',
  subtotal: '2.99', discount_total: '0.00', total: '2.99', issued_at: '2026-10-06T15:00:00Z', voided_at: null, void_reason: null, lines: [],
} as Ticket

const button = (label: string) => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

beforeEach(() => {
  vi.clearAllMocks()
  window.print = vi.fn<() => void>()
  vi.mocked(salesApi.get).mockResolvedValue(ticket)
  vi.mocked(salesApi.ticketPdf).mockResolvedValue(undefined)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('imprimir en la app Android', () => {
  it('el detalle del ticket comparte el PDF de 80 mm en vez de window.print', async () => {
    await mountWithRouter(TicketView, { path: '/ventas/9', pattern: '/ventas/:id' })

    button('Imprimir').click()
    await flushPromises()

    expect(salesApi.ticketPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }))
    expect(window.print).not.toHaveBeenCalled()
  })

  it('la confirmación de venta comparte el PDF del ticket', async () => {
    const { router } = await mountWithRouter({ template: '<div />' })
    setActivePinia(createPinia())
    mount(SaleDoneDialog, { props: { open: true, sale: { kind: 'ticket', ticket } }, global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    button('Imprimir').click()
    await flushPromises()

    expect(salesApi.ticketPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }))
    expect(window.print).not.toHaveBeenCalled()
  })
})
