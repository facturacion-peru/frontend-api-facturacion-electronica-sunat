import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { getToken, setToken, clearToken } from '../token-storage'

describe('token-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('devuelve null cuando no hay token guardado', () => {
    expect(getToken()).toBeNull()
  })

  it('persiste y recupera el token', () => {
    setToken('sunat_beta_abc123')

    expect(getToken()).toBe('sunat_beta_abc123')
  })

  it('borra el token', () => {
    setToken('sunat_beta_abc123')
    clearToken()

    expect(getToken()).toBeNull()
  })

  it('no lanza cuando el almacenamiento está bloqueado', () => {
    // Modo privado o cookies bloqueadas: el acceso a localStorage lanza.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('acceso denegado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('acceso denegado')
    })

    expect(() => setToken('x')).not.toThrow()
    expect(getToken()).toBeNull()
  })
})
