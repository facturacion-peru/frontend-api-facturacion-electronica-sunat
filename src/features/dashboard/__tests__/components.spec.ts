import { afterEach, describe, expect, it } from 'vitest'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import AttentionList from '../components/AttentionList.vue'
import RecentSales from '../components/RecentSales.vue'
import TodaySummary from '../components/TodaySummary.vue'
import WeekChart from '../components/WeekChart.vue'
import { summary, withProps } from './fixtures'

/*
 * Spec 011 · T010: piezas del panel de inicio.
 */
afterEach(() => {
  document.body.innerHTML = ''
})

describe('TodaySummary', () => {
  it('HU-1 muestra el monto y la cantidad de hoy, aclarando qué incluye (A-54)', async () => {
    const { wrapper } = await mountWithRouter(withProps(TodaySummary, { today: summary().today, scope: 'company' }))

    expect(wrapper.text()).toContain('Ventas de hoy')
    expect(wrapper.text()).toMatch(/S\/\s*81\.60/)
    expect(wrapper.text()).toContain('5 ventas')
    expect(wrapper.text()).toContain('notas de crédito')
  })

  it('A-53 al vendedor le habla de sus ventas y usa el singular', async () => {
    const { wrapper } = await mountWithRouter(withProps(TodaySummary, { today: { total: '10.00', count: 1 }, scope: 'own' }))

    expect(wrapper.text()).toContain('Tus ventas de hoy')
    expect(wrapper.text()).toContain('1 venta')
  })
})

describe('AttentionList', () => {
  it('HU-2 enlaza cada pendiente a su listado ya filtrado', async () => {
    const { wrapper } = await mountWithRouter(withProps(AttentionList, { attention: summary().attention }))
    const links = wrapper.findAll('a').map((a) => [a.text(), a.attributes('href')])

    expect(links).toEqual([
      [expect.stringContaining('2 comprobantes por enviar'), '/__sales-documents?status=pending'],
      [expect.stringContaining('1 comprobante rechazado'), '/__sales-documents?status=rejected'],
      [expect.stringContaining('3 alertas de inventario'), '/__inventory-alerts'],
    ])
  })

  it('HU-2 sin pendientes dice que todo está al día; el vendedor no ve alertas', async () => {
    const { wrapper } = await mountWithRouter(
      withProps(AttentionList, { attention: { pending_documents: 0, rejected_documents: 0, inventory_alerts: null } }),
    )

    expect(wrapper.text()).toContain('Todo al día')
    expect(wrapper.findAll('a')).toHaveLength(0)
  })
})

describe('WeekChart', () => {
  it('HU-1 tiene una tabla para lectores de pantalla con los 7 días y marca hoy', async () => {
    const { wrapper } = await mountWithRouter(withProps(WeekChart, { days: summary().last_7_days }))
    const rows = wrapper.findAll('tbody tr')

    expect(rows).toHaveLength(7)
    expect(rows[6]!.text()).toContain('Hoy')
    expect(rows[3]!.text()).toMatch(/169\.20/)
    expect(wrapper.findAll('[data-test="bar"]')).toHaveLength(7)
  })
})

describe('RecentSales', () => {
  it('HU-3 lista las ventas con enlace a su detalle', async () => {
    const { wrapper } = await mountWithRouter(withProps(RecentSales, { sales: summary().recent_sales }))
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))

    expect(hrefs).toContain('/__ticket-detail/41')
    expect(hrefs).toContain('/__sales-document-detail/9')
    expect(wrapper.text()).toContain('Boleta B001-00000009')
    expect(wrapper.text()).toContain('Aceptado')
  })

  it('sin ventas invita a registrar la primera', async () => {
    const { wrapper } = await mountWithRouter(withProps(RecentSales, { sales: [] }))

    expect(wrapper.text()).toContain('Registra tu primera venta')
  })
})
