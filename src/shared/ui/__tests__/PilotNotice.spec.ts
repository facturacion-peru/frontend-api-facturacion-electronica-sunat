import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

/*
 * T016 · Aviso del piloto sin datos reales de clientes (spec 009, A-43).
 */

async function mountWith(pilotMode: boolean) {
  vi.resetModules()
  vi.doMock('@/core/config/env', () => ({ env: { pilotMode } }))
  const PilotNotice = (await import('../PilotNotice.vue')).default

  return mount(PilotNotice)
}

afterEach(() => {
  vi.doUnmock('@/core/config/env')
})

describe('PilotNotice', () => {
  it('en el piloto avisa que no se registren datos reales de clientes', async () => {
    const wrapper = await mountWith(true)

    expect(wrapper.find('[data-test="pilot-notice"]').text()).toContain('no registres datos personales reales')
  })

  it('fuera del piloto no se muestra', async () => {
    const wrapper = await mountWith(false)

    expect(wrapper.find('[data-test="pilot-notice"]').exists()).toBe(false)
  })
})
