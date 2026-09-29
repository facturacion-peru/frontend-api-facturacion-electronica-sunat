import { describe, expect, it } from 'vitest'

import { grossAmount, lineAmount, sumAmounts } from '../pricing'

describe('pricing (misma regla que el servidor)', () => {
  it('redondea mitad hacia arriba a céntimos', () => {
    expect(grossAmount('3', '2.99')).toBe('8.97')
    expect(grossAmount('0.375', '4.20')).toBe('1.58') // 1.575
    expect(grossAmount('1.333', '2.99')).toBe('3.99') // 3.98567
    expect(grossAmount('2.5', '4.20')).toBe('10.50')
  })

  it('resta el descuento y suma sin coma flotante', () => {
    expect(lineAmount('3', '2.99', '0.97')).toBe('8.00')
    expect(sumAmounts(['8.00', '1.58'])).toBe('9.58')
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30')
  })
})
