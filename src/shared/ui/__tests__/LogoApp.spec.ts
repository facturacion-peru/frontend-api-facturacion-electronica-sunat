import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { env } from '@/core/config/env'
import LogoApp from '../LogoApp.vue'

describe('LogoApp', () => {
  it('solo el símbolo se anuncia como imagen con el nombre de la app', () => {
    const svg = mount(LogoApp).get('svg')

    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe(env.appName)
  })

  it('con el nombre visible, el símbolo queda oculto a lectores de pantalla', () => {
    const wrapper = mount(LogoApp, { props: { withName: true, size: 32 } })

    expect(wrapper.text()).toContain(env.appName)
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('svg').attributes('width')).toBe('32')
  })
})
