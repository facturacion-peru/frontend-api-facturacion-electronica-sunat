import { describe, expect, it } from 'vitest'

import { formatDate, formatMoney, formatQuantity } from '../format'

describe('format', () => {
  it('formatea soles', () => {
    expect(formatMoney('25.90')).toMatch(/S\/\s?25\.90/)
    expect(formatMoney(null)).toBe('—')
  })

  it('quita los ceros decimales sobrantes de las cantidades', () => {
    expect(formatQuantity('36.000')).toBe('36')
    expect(formatQuantity('50.500')).toBe('50,5')
    expect(formatQuantity('0.375')).toBe('0,375')
    expect(formatQuantity('-2.000')).toBe('-2')
    expect(formatQuantity(null)).toBe('—')
  })

  it('muestra fechas sin desfase de zona horaria', () => {
    expect(formatDate('2026-10-01')).toContain('2026')
    expect(formatDate('2026-10-01')).toMatch(/^1 /)
  })
})
