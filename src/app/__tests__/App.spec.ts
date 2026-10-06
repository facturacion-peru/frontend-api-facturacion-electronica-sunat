import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { updateRequired } from '@/core/api/app-update'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import App from '@/App.vue'

/* Spec 013 · T016, HU-5: con una versión desactualizada, la app pide actualizar. */
describe('App', () => {
  it('muestra «Actualiza la app» con la versión mínima cuando la API responde 426', async () => {
    const { wrapper } = await mountWithRouter(App)
    expect(wrapper.find('[data-test="update-required"]').exists()).toBe(false)

    updateRequired.value = '0.3.0'
    await flushPromises()

    expect(wrapper.get('[data-test="update-required"]').text()).toContain('Actualiza la app')
    expect(wrapper.text()).toContain('0.3.0')
    updateRequired.value = null
  })
})
