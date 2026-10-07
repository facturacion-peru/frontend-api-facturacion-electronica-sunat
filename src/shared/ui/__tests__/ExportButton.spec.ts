import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import ExportButton from '../ExportButton.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

const button = (text: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!

describe('ExportButton', () => {
  it('descarga en el formato elegido y cierra el diálogo', async () => {
    const download = vi.fn<(format: string) => Promise<void>>().mockResolvedValue(undefined)
    const wrapper = mount(ExportButton, { props: { title: 'Exportar productos', download }, attachTo: document.body })

    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Exportar productos')
    button('Descargar').click()
    await flushPromises()

    expect(download).toHaveBeenCalledWith('xlsx')
    expect(document.querySelector('[data-test="export-format"]')).toBeNull()
  })

  it('muestra el error y deja el diálogo abierto', async () => {
    const download = vi.fn<(format: string) => Promise<void>>().mockRejectedValue(new ApiError(429, 'Demasiados intentos. Inténtalo más tarde.'))
    const wrapper = mount(ExportButton, { props: { title: 'Exportar clientes', download }, attachTo: document.body })

    await wrapper.find('button').trigger('click')
    await flushPromises()
    button('Descargar').click()
    await flushPromises()

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Demasiados intentos')
    expect(document.querySelector('[data-test="export-format"]')).not.toBeNull()
  })
})
