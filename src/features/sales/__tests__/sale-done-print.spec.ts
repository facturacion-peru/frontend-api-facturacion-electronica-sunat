import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { principal, sessionWith } from '@/shared/testing/establishments'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { Ticket } from '../types'

/*
 * Imprimir desde «Venta registrada» en el navegador: el recibo va directo en
 * <body>, fuera del diálogo. Dentro, se ubicaba respecto del panel del
 * diálogo y salía movido y cortado.
 */
vi.mock('../api', () => ({ salesApi: { ticketPdf: vi.fn<() => Promise<void>>() }, salesDocumentsApi: { download: vi.fn<() => Promise<void>>() } }))

const SaleDoneDialog = (await import('../components/SaleDoneDialog.vue')).default

const ticket = {
  id: 9, display_number: 'T-000009', status: 'issued', legal_notice: 'Documento interno', seller: null, customer_label: 'Cliente varios',
  customer_document: null, payment_method: 'cash', total: '9.80', discount_total: '0.00', issued_at: '2026-10-30T16:00:00Z', lines: [],
  establishment: { id: 1, code: '0000', name: 'Principal' },
} as unknown as Ticket

afterEach(() => {
  document.body.innerHTML = ''
})

describe('imprimir tras cobrar, en el navegador', () => {
  it('el recibo se imprime fuera del diálogo', async () => {
    window.print = vi.fn<() => void>()
    const { router } = await mountWithRouter({ template: '<div />' }, { beforeMount: () => sessionWith([principal]) })
    mount(SaleDoneDialog, { props: { open: true, sale: { kind: 'ticket', ticket } }, global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Imprimir')!.click()
    await flushPromises()

    expect(window.print).toHaveBeenCalled()
    const receipt = document.querySelector('.print-area')!
    expect(receipt.textContent).toContain('T-000009')
    expect(receipt.parentElement).toBe(document.body)
    expect(receipt.closest('[role="dialog"]')).toBeNull()
  })
})
