import { describe, expect, it } from 'vitest'

import { documentKind, isDni, isRuc } from '../documents'

/*
 * Spec 018 · F002 (RF-005): formato de DNI y RUC antes de consultar, con el
 * mismo cálculo que App\Rules\Ruc.
 */
describe('documentos', () => {
  it('un DNI tiene 8 dígitos', () => {
    expect(isDni('45678912')).toBe(true)
    expect(isDni('4567891')).toBe(false)
    expect(isDni('4567891a')).toBe(false)
  })

  // Dígitos verificadores calculados con App\Rules\Ruc::checkDigit.
  it.each(['20131312955', '20600000013', '20100070970', '10456789124'])('%s es un RUC válido', (ruc) => {
    expect(isRuc(ruc)).toBe(true)
  })

  it.each([
    ['20131312956', 'dígito verificador'],
    ['30131312955', 'prefijo distinto de 10 o 20'],
    ['2013131295', '10 dígitos'],
    ['2013131295a', 'con letras'],
  ])('%s no es un RUC válido (%s)', (ruc) => {
    expect(isRuc(ruc)).toBe(false)
  })

  it('documentKind solo mira la cantidad de dígitos', () => {
    expect(documentKind(' 45678912 ')).toBe('dni')
    expect(documentKind('20131312956')).toBe('ruc')
    expect(documentKind('Juan Pérez')).toBeNull()
    expect(documentKind('123456789')).toBeNull()
  })
})
