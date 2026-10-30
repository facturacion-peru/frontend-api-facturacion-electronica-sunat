import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

/*
 * Spec 016 · F009: elegir la foto (HU-1 esc. 4 y 6, HU-3 esc. 1, 5 y 6).
 * No sube nada: deja la foto reducida en v-model con su vista previa.
 */
const fake = vi.hoisted(() => ({
  isNative: false,
  pickImage: vi.fn<(source: 'camera' | 'gallery') => Promise<File | null>>(),
}))
vi.mock('@/core/device', () => ({ device: () => fake }))

const prepare = vi.hoisted(() => vi.fn<(file: File) => Promise<File>>())
vi.mock('@/shared/images/prepare', async (original) => ({
  ...(await original<typeof import('@/shared/images/prepare')>()),
  prepareProductPhoto: prepare,
}))

const { ImageRejected } = await import('@/shared/images/prepare')
const { dismissTop } = await import('../dismissable')
const ImagePicker = (await import('../ImagePicker.vue')).default

const saved = { url: 'https://img.test/a.webp', thumb_url: 'https://img.test/a-thumb.webp' }
const original = new File(['original'], 'IMG_1.jpg', { type: 'image/jpeg' })
const reduced = new File(['reducida'], 'IMG_1.jpg', { type: 'image/jpeg' })

let wrapper: VueWrapper | undefined

function mountPicker(props: Record<string, unknown> = {}) {
  wrapper = mount(ImagePicker, {
    props: { image: null, name: 'Arroz', modelValue: null, 'onUpdate:modelValue': (f: File | null) => wrapper!.setProps({ modelValue: f }), ...props },
    attachTo: document.body,
  })
  return wrapper
}

beforeEach(() => {
  fake.isNative = false
  fake.pickImage.mockReset()
  prepare.mockReset()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vista-previa')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ImagePicker', () => {
  it('en la web abre directo el selector; deja la foto reducida y su vista previa', async () => {
    fake.pickImage.mockResolvedValue(original)
    prepare.mockResolvedValue(reduced)
    const picker = mountPicker()

    expect(picker.get('[data-test="choose-photo"]').text()).toBe('Agregar foto')
    await picker.get('[data-test="choose-photo"]').trigger('click')
    await flushPromises()

    expect(fake.pickImage).toHaveBeenCalledWith('gallery')
    expect(prepare).toHaveBeenCalledWith(original)
    expect(picker.emitted('update:modelValue')).toEqual([[reduced]])
    expect(picker.get('[data-test="preview"]').attributes('src')).toBe('blob:vista-previa')
  })

  it('«Descartar» vuelve a la foto guardada sin emitir nada más y libera la vista previa', async () => {
    const picker = mountPicker({ image: saved, modelValue: reduced })

    await picker.get('[data-test="discard-photo"]').trigger('click')

    expect(picker.emitted('update:modelValue')).toEqual([[null]])
    expect(picker.find('[data-test="preview"]').exists()).toBe(false)
    expect(picker.get('img').attributes('src')).toBe(saved.url)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vista-previa')
  })

  it('libera la vista previa al desmontarse', () => {
    mountPicker({ modelValue: reduced }).unmount()
    wrapper = undefined
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vista-previa')
  })

  it('muestra el motivo si la foto no se acepta, sin cambiar el v-model', async () => {
    fake.pickImage.mockResolvedValue(original)
    prepare.mockRejectedValue(new ImageRejected('Formato no admitido. Usa una foto JPG, PNG o WebP.'))
    const picker = mountPicker()

    await picker.get('[data-test="choose-photo"]').trigger('click')
    await flushPromises()

    expect(picker.get('[data-test="photo-error"]').text()).toBe('Formato no admitido. Usa una foto JPG, PNG o WebP.')
    expect(picker.emitted('update:modelValue')).toBeUndefined()
  })

  it('cancelar el selector no cambia nada', async () => {
    fake.pickImage.mockResolvedValue(null)
    const picker = mountPicker()

    await picker.get('[data-test="choose-photo"]').trigger('click')
    await flushPromises()

    expect(prepare).not.toHaveBeenCalled()
    expect(picker.emitted('update:modelValue')).toBeUndefined()
  })

  it('con foto guardada ofrece cambiarla y, si se puede, quitarla', async () => {
    const picker = mountPicker({ image: saved, removable: true })

    expect(picker.get('[data-test="choose-photo"]').text()).toBe('Cambiar foto')
    await picker.get('[data-test="remove-photo"]').trigger('click')
    expect(picker.emitted('remove')).toHaveLength(1)

    await picker.setProps({ removable: false })
    expect(picker.find('[data-test="remove-photo"]').exists()).toBe(false)
  })

  describe('en la app Android', () => {
    beforeEach(() => {
      fake.isNative = true
    })

    it('«Agregar foto» ofrece «Tomar foto» y «Elegir de la galería»', async () => {
      fake.pickImage.mockResolvedValue(original)
      prepare.mockResolvedValue(reduced)
      mountPicker()

      await wrapper!.get('[data-test="choose-photo"]').trigger('click')
      await nextTick()
      expect(fake.pickImage).not.toHaveBeenCalled()

      document.querySelector<HTMLButtonElement>('[data-test="pick-camera"]')!.click()
      await flushPromises()

      expect(fake.pickImage).toHaveBeenCalledWith('camera')
      expect(document.querySelector('[data-test="pick-camera"]')).toBeNull()
      expect(wrapper!.emitted('update:modelValue')).toEqual([[reduced]])
    })

    it('«Atrás» cierra el diálogo sin elegir', async () => {
      mountPicker()

      await wrapper!.get('[data-test="choose-photo"]').trigger('click')
      await nextTick()
      expect(document.querySelector('[data-test="pick-gallery"]')).not.toBeNull()

      expect(dismissTop()).toBe(true)
      await nextTick()
      expect(document.querySelector('[data-test="pick-gallery"]')).toBeNull()
      expect(fake.pickImage).not.toHaveBeenCalled()
    })
  })
})
