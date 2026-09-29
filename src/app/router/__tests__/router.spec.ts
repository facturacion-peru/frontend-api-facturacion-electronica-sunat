import { describe, expect, it } from 'vitest'

import router from '../index'

describe('router', () => {
  it('«/» abre el Inicio dentro del layout de la aplicación, no el de acceso', () => {
    const resolved = router.resolve('/')

    expect(resolved.name).toBe('home')
    expect(resolved.matched.map((r) => r.name ?? r.path)).toEqual(['/', 'home'])
    expect(resolved.meta.requiresAuth).toBe(true)
  })
  it('las pantallas de acceso siguen en su layout, sin exigir sesión', () => {
    const resolved = router.resolve('/login')

    expect(resolved.name).toBe('login')
    expect(resolved.meta.requiresAuth).toBeUndefined()
  })
})
