import { afterEach, describe, expect, it, vi } from 'vitest'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ inventoryApi: { alerts: vi.fn<AsyncFn>() } }))

const { inventoryApi } = await import('../api')
const AlertsView = (await import('../views/AlertsView.vue')).default

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AlertsView', () => {
  it('muestra stock bajo, próximos a vencer y vencidos con saldo', async () => {
    vi.mocked(inventoryApi.alerts).mockResolvedValue({
      low_stock: [{ id: 1, code: 'LEC-001', name: 'Leche evaporada', available_stock: '8.000', min_stock: '12.000' }],
      expiring: [
        { id: 3, lot_number: 'L-1', product: { id: 2, code: 'YOG-001', name: 'Yogur' }, expires_at: '2026-10-08', days_left: 1, remaining_quantity: '10.000' },
      ],
      expired: [
        { id: 4, lot_number: 'L-0', product: { id: 2, code: 'YOG-001', name: 'Yogur' }, expires_at: '2026-09-20', days_left: -8, remaining_quantity: '2.000' },
      ],
    })

    const { wrapper } = await mountWithRouter(AlertsView)

    expect(wrapper.find('[data-test="low-stock-row"]').text()).toContain('8 disponibles')
    expect(wrapper.find('[data-test="expiring-row"]').text()).toContain('Vence mañana')
    expect(wrapper.find('[data-test="expired-row"]').text()).toContain('Yogur')
  })

  it('indica cuando no hay alertas', async () => {
    vi.mocked(inventoryApi.alerts).mockResolvedValue({ low_stock: [], expiring: [], expired: [] })

    const { wrapper } = await mountWithRouter(AlertsView)

    expect(wrapper.text()).toContain('Ningún producto por debajo de su mínimo')
    expect(wrapper.text()).toContain('Ningún lote vence pronto')
    expect(wrapper.find('#expired-title').exists()).toBe(false)
  })
})
