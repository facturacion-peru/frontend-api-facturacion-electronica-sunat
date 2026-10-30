import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PasswordInput from '../PasswordInput.vue'

/*
 * Inicio de sesión: ver la contraseña mientras se escribe.
 */
describe('PasswordInput', () => {
  it('empieza oculta y pasa los atributos al campo', () => {
    const wrapper = mount(PasswordInput, { props: { modelValue: '' }, attrs: { id: 'password', autocomplete: 'current-password' } })

    expect(wrapper.get('input').attributes()).toMatchObject({ id: 'password', type: 'password', autocomplete: 'current-password' })
    expect(wrapper.get('[data-test="toggle-password"]').attributes()).toMatchObject({
      type: 'button',
      'aria-label': 'Mostrar contraseña',
      'aria-pressed': 'false',
    })
  })

  it('el botón muestra y vuelve a ocultar la contraseña sin tocar el texto', async () => {
    const wrapper = mount(PasswordInput, { props: { modelValue: 'clave-segura-123' } })
    const toggle = wrapper.get('[data-test="toggle-password"]')

    await toggle.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('clave-segura-123')

    await toggle.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('password')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
