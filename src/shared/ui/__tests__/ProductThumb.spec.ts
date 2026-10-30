import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProductThumb from '../ProductThumb.vue'

/*
 * Spec 016 · F008 (HU-2, RF-013): miniatura con espacio reservado, carga
 * diferida y marcador sin foto o si no carga.
 */
const image = { url: 'https://img.test/abc.webp', thumb_url: 'https://img.test/abc-thumb.webp' }

describe('ProductThumb', () => {
  it('muestra la miniatura con el nombre como texto alternativo y carga diferida', () => {
    const wrapper = mount(ProductThumb, { props: { image, name: 'Arroz Costeño 1 kg', size: 'md' } })
    const img = wrapper.get('img')

    expect(img.attributes()).toMatchObject({ src: image.thumb_url, alt: 'Arroz Costeño 1 kg', loading: 'lazy' })
    expect(wrapper.find('[data-test="thumb-placeholder"]').exists()).toBe(false)
  })

  it('en la ficha (lg) usa la foto grande', () => {
    const wrapper = mount(ProductThumb, { props: { image, name: 'Arroz', size: 'lg' } })
    expect(wrapper.get('img').attributes('src')).toBe(image.url)
  })

  it('sin foto muestra el marcador, oculto al lector de pantalla', () => {
    const wrapper = mount(ProductThumb, { props: { image: null, name: 'Arroz' } })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[data-test="thumb-placeholder"]').attributes('aria-hidden')).toBe('true')
  })

  it('si la foto no carga, cambia al marcador; con otra foto lo vuelve a intentar', async () => {
    const wrapper = mount(ProductThumb, { props: { image, name: 'Arroz' } })

    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[data-test="thumb-placeholder"]').exists()).toBe(true)

    await wrapper.setProps({ image: { url: 'https://img.test/nueva.webp', thumb_url: 'https://img.test/nueva-thumb.webp' } })
    expect(wrapper.get('img').attributes('src')).toBe('https://img.test/nueva-thumb.webp')
  })

  it('la caja mide lo mismo con foto y sin ella, para que nada se mueva', () => {
    const withPhoto = mount(ProductThumb, { props: { image, name: 'Arroz', size: 'md' } })
    const without = mount(ProductThumb, { props: { image: null, name: 'Arroz', size: 'md' } })

    const box = (w: typeof withPhoto) => w.get('[data-test="product-thumb"]').classes()
    expect(box(withPhoto)).toEqual(box(without))
    expect(box(withPhoto)).toEqual(expect.arrayContaining(['size-16', 'aspect-square']))
  })
})
