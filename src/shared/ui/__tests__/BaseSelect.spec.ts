import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BaseSelect from '../BaseSelect.vue'

/*
 * Spec 010 · HU-4 (RF-007): lista desplegable con el estilo único de campo.
 */
describe('BaseSelect', () => {
  const slots = { default: '<option value="a">A</option><option value="b">B</option>' }

  it('enlaza el v-model y pasa los atributos al <select>', async () => {
    const wrapper = mount(BaseSelect, { props: { modelValue: 'a' }, attrs: { id: 'tipo' }, slots })
    const select = wrapper.get('select')

    expect(select.attributes('id')).toBe('tipo')
    await select.setValue('b')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  it('marca el error para lectores de pantalla', () => {
    const wrapper = mount(BaseSelect, { props: { modelValue: 'a', invalid: true }, slots })

    expect(wrapper.get('select').attributes('aria-invalid')).toBe('true')
  })
})
