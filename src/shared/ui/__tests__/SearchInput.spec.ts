import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SearchInput from '../SearchInput.vue'

/*
 * Spec 010 · HU-4: búsqueda con lupa y botón para limpiar el filtro.
 */
describe('SearchInput', () => {
  it('muestra la lupa y pasa los atributos al campo', () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '' }, attrs: { id: 'q', placeholder: 'Buscar' } })

    expect(wrapper.find('[data-test="search-icon"]').exists()).toBe(true)
    expect(wrapper.get('input').attributes()).toMatchObject({ id: 'q', type: 'search', placeholder: 'Buscar' })
  })

  it('solo ofrece limpiar cuando hay texto', async () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '' } })
    expect(wrapper.find('button').exists()).toBe(false)

    await wrapper.setProps({ modelValue: 'arroz' })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Limpiar búsqueda')
  })

  it('limpiar vacía el texto, avisa con clear y devuelve el foco al campo', async () => {
    const wrapper = mount(SearchInput, {
      props: { modelValue: 'arroz', 'onUpdate:modelValue': (v: string) => wrapper.setProps({ modelValue: v }) },
      attachTo: document.body,
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(document.activeElement).toBe(wrapper.get('input').element)
    wrapper.unmount()
  })
})
