import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SalesDocument, Ticket } from '../types'

/*
 * Spec 015 · T028 (HU-2, HU-3, HU-4, RF-002, RF-007): con una impresora
 * elegida en la app, los «Imprimir» de siempre van directo a la impresora.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

const print = vi.hoisted(() => vi.fn<AsyncFn>())
vi.mock('@/core/device', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/core/device')>()
  return { ...real, device: () => ({ isNative: true, appVersion: '0.2.0', printer: { available: true, print } }) }
})
vi.mock('@/features/printing/api', () => ({
  printingApi: { ticket: vi.fn<AsyncFn>(), document: vi.fn<AsyncFn>(), testPage: vi.fn<AsyncFn>() },
}))
vi.mock('../api', () => ({
  salesApi: { get: vi.fn<AsyncFn>(), void: vi.fn<AsyncFn>(), ticketPdf: vi.fn<AsyncFn>() },
  salesDocumentsApi: { get: vi.fn<AsyncFn>(), download: vi.fn<AsyncFn>(), retry: vi.fn<AsyncFn>() },
}))

const { PrinterError } = await import('@/core/device')
const { printingApi } = await import('@/features/printing/api')
const { usePrinterSettingsStore } = await import('@/features/printing/stores/printer-settings')
const { salesApi, salesDocumentsApi } = await import('../api')
const TicketView = (await import('../views/TicketView.vue')).default
const SalesDocumentView = (await import('../views/SalesDocumentView.vue')).default
const SaleDoneDialog = (await import('../components/SaleDoneDialog.vue')).default
type SaleDone = import('../components/SaleDoneDialog.vue').SaleDone

const ADDRESS = '00:11:22:33:44:55'
const BYTES = new Uint8Array([0x1b, 0x40])

const ticket = {
  id: 9, number: 9, display_number: 'T-000009', status: 'issued', legal_notice: 'Documento interno — no es comprobante de pago',
  seller: null, customer_name: null, customer_label: 'Cliente varios', customer_document: null, payment_method: 'cash',
  subtotal: '2.99', discount_total: '0.00', total: '2.99', issued_at: '2026-10-06T15:00:00Z', voided_at: null, void_reason: null, lines: [],
} as Ticket

const salesDocument = {
  id: 31, document_type: '03', document_type_label: 'Boleta de venta', display_number: 'B001-00000151', environment: 'beta',
  environment_notice: 'PRUEBAS — sin valor legal', issued_at: '2026-09-29T15:00:00+00:00', seller: { id: 2, name: 'Luis' },
  payment_method: 'cash', customer: { id: null, document_type: '0', document_number: '-', name: 'CLIENTES VARIOS', address: null },
  op_gravadas: '43.90', op_exoneradas: '0.00', op_inafectas: '0.00', igv: '7.90', discount_total: '0.00', total: '51.80',
  status: 'accepted', status_label: 'Aceptado', sunat_code: '0', sunat_message: 'aceptada', sunat_notes: [], hash: 'abc=', has_cdr: true,
  attempts: 1, can_retry: false, correction_status: 'none', correction_status_label: 'Vigente', can_credit: false, reference: null,
  credit_notes: [], lines: [], submissions: [],
} as unknown as SalesDocument

const button = (label: string) => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined

function choosePrinter(autoPrint = false) {
  const settings = usePrinterSettingsStore()
  settings.choose({ name: 'MTP-II', address: ADDRESS })
  settings.autoPrint = autoPrint
}

async function mountDialog(sale: SaleDone, beforeMount: () => void) {
  const { router } = await mountWithRouter({ template: '<div />' })
  setActivePinia(createPinia())
  beforeMount()
  const wrapper = mount(SaleDoneDialog, { props: { open: true, sale }, global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  window.print = vi.fn<() => void>()
  print.mockResolvedValue(undefined)
  vi.mocked(printingApi.ticket).mockResolvedValue(BYTES)
  vi.mocked(printingApi.document).mockResolvedValue(BYTES)
  vi.mocked(salesApi.get).mockResolvedValue(ticket)
  vi.mocked(salesDocumentsApi.get).mockResolvedValue(salesDocument)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('tras cobrar', () => {
  it('«Imprimir» envía el ticket a la impresora, sin PDF ni navegador', async () => {
    await mountDialog({ kind: 'ticket', ticket }, () => choosePrinter())
    expect(print).not.toHaveBeenCalled()

    button('Imprimir')!.click()
    await flushPromises()

    expect(printingApi.ticket).toHaveBeenCalledWith(9, { width: 58, qr: 'native' })
    expect(print).toHaveBeenCalledWith(ADDRESS, BYTES)
    expect(salesApi.ticketPdf).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
  })

  it('con «Imprimir al cobrar», el ticket se imprime solo, una vez', async () => {
    const wrapper = await mountDialog({ kind: 'ticket', ticket }, () => choosePrinter(true))

    expect(print).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('con «Imprimir al cobrar», un comprobante también se imprime solo', async () => {
    await mountDialog({ kind: 'document', document: salesDocument }, () => choosePrinter(true))

    expect(printingApi.document).toHaveBeenCalledWith(31, { width: 58, qr: 'native' })
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('la venta siguiente también se imprime sola', async () => {
    const wrapper = await mountDialog({ kind: 'ticket', ticket }, () => choosePrinter(true))
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true, sale: { kind: 'ticket', ticket: { ...ticket, id: 10, display_number: 'T-000010' } } })
    await flushPromises()

    expect(printingApi.ticket).toHaveBeenLastCalledWith(10, expect.anything())
    expect(print).toHaveBeenCalledTimes(2)
  })

  it('sin «Imprimir al cobrar» (por defecto), no imprime solo', async () => {
    await mountDialog({ kind: 'ticket', ticket }, () => choosePrinter(false))

    expect(print).not.toHaveBeenCalled()
    expect(salesApi.ticketPdf).not.toHaveBeenCalled()
  })

  it('si falla, muestra el motivo y «Compartir PDF» abre el PDF del ticket', async () => {
    print.mockRejectedValueOnce(new PrinterError('connect_failed'))
    await mountDialog({ kind: 'ticket', ticket }, () => choosePrinter())

    button('Imprimir')!.click()
    await flushPromises()
    expect(document.body.querySelector('[data-test="print-failed"]')!.textContent).toContain('encendida')
    expect(document.body.textContent).toContain('Venta registrada')

    button('Compartir PDF')!.click()
    await flushPromises()
    expect(salesApi.ticketPdf).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }))
  })
})

it('el aviso de fallo de una venta no queda en la siguiente (encontrado en el teléfono)', async () => {
  print.mockRejectedValueOnce(new PrinterError('connect_failed'))
  const wrapper = await mountDialog({ kind: 'ticket', ticket }, () => choosePrinter())
  button('Imprimir')!.click()
  await flushPromises()
  expect(document.body.querySelector('[data-test="print-failed"]')).not.toBeNull()

  // «Nueva venta» cierra el diálogo; la venta siguiente lo vuelve a abrir.
  await wrapper.setProps({ open: false })
  await wrapper.setProps({ open: true, sale: { kind: 'document', document: salesDocument } })
  await flushPromises()

  expect(document.body.querySelector('[data-test="print-failed"]')).toBeNull()
})

describe('detalle del ticket', () => {
  it('«Imprimir» va a la impresora; si falla, «Reintentar» vuelve a enviarlo', async () => {
    print.mockRejectedValueOnce(new PrinterError('write_failed'))
    await mountWithRouter(TicketView, { path: '/ventas/9', pattern: '/ventas/:id', beforeMount: () => choosePrinter() })

    button('Imprimir')!.click()
    await flushPromises()
    expect(document.body.querySelector('[data-test="print-failed"]')).not.toBeNull()

    button('Reintentar')!.click()
    await flushPromises()

    expect(print).toHaveBeenCalledTimes(2)
    expect(document.body.querySelector('[data-test="print-failed"]')).toBeNull()
    expect(window.print).not.toHaveBeenCalled()
  })
})

describe('detalle del comprobante', () => {
  it('con impresora, aparece «Imprimir» y envía el comprobante', async () => {
    await mountWithRouter(SalesDocumentView, { path: '/ventas/comprobantes/31', pattern: '/ventas/comprobantes/:id', beforeMount: () => choosePrinter() })

    document.body.querySelector<HTMLButtonElement>('[data-test="print"]')!.click()
    await flushPromises()

    expect(printingApi.document).toHaveBeenCalledWith(31, { width: 58, qr: 'native' })
    expect(print).toHaveBeenCalledWith(ADDRESS, BYTES)
    expect(button('PDF 80 mm')).toBeDefined()
  })

  it('sin impresora elegida, no aparece «Imprimir» (queda «PDF 80 mm»)', async () => {
    await mountWithRouter(SalesDocumentView, { path: '/ventas/comprobantes/31', pattern: '/ventas/comprobantes/:id' })

    expect(document.body.querySelector('[data-test="print"]')).toBeNull()
    expect(button('PDF 80 mm')).toBeDefined()
  })
})
