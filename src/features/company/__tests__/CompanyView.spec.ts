import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { CompanyDetail } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  companyApi: {
    get: vi.fn<AsyncFn>(),
    update: vi.fn<AsyncFn>(),
    uploadLogo: vi.fn<(file: File, options?: { onProgress?: (fraction: number) => void }) => Promise<unknown>>(),
  },
}))

const { companyApi } = await import('../api')
const CompanyView = (await import('../views/CompanyView.vue')).default

const company: CompanyDetail = {
  id: 7, ruc: '20131312955', razon_social: 'Bodega Ana S.A.C.', nombre_comercial: 'Bodega Ana',
  person_type: 'juridica', tax_regime: 'rmt', email: 'contacto@bodega.pe', phone: null, logo_url: null, active: true, expiry_warning_days: 30,
  fiscal_address: { address: 'Av. Uno 1', ubigeo: '150101', district: 'Lima / Lima / Lima' }, created_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(companyApi.get).mockResolvedValue(company)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CompanyView', () => {
  it('muestra RUC y razón social como datos de solo lectura', async () => {
    const { wrapper } = await mountWithRouter(CompanyView)

    const legal = wrapper.find('[data-test="legal-data"]')
    expect(legal.text()).toContain('20131312955')
    expect(legal.text()).toContain('Bodega Ana S.A.C.')
    expect(legal.text()).toContain('Régimen MYPE Tributario')
    expect(wrapper.find('input#ruc').exists()).toBe(false)
  })

  it('guarda solo los datos de contacto', async () => {
    vi.mocked(companyApi.update).mockResolvedValue({ ...company, phone: '987654321' })
    const { wrapper } = await mountWithRouter(CompanyView)

    await wrapper.find('#phone').setValue('987654321')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(companyApi.update).toHaveBeenCalledWith({
      nombre_comercial: 'Bodega Ana', email: 'contacto@bodega.pe', phone: '987654321', expiry_warning_days: 30,
    })
    expect(wrapper.text()).toContain('Cambios guardados.')
  })

  it('permite cambiar los días de aviso de vencimiento', async () => {
    vi.mocked(companyApi.update).mockResolvedValue({ ...company, expiry_warning_days: 45 })
    const { wrapper } = await mountWithRouter(CompanyView)

    await wrapper.find('#expiry_warning_days').setValue('45')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(companyApi.update).toHaveBeenCalledWith(expect.objectContaining({ expiry_warning_days: 45 }))
  })

  it('muestra los errores por campo', async () => {
    vi.mocked(companyApi.update).mockRejectedValue(new ApiError(422, 'x', { email: ['El campo correo debe ser válido.'] }))
    const { wrapper } = await mountWithRouter(CompanyView)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#company-email-error').text()).toBe('El campo correo debe ser válido.')
  })

  describe('logo (spec 016)', () => {
    /** Cabecera PNG mínima (firma + IHDR) con relleno hasta `size` bytes. */
    function pngFile(name: string, size = 64, type = 'image/png') {
      const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0, 0, 0, 0, 100, 8, 6, 0, 0, 0]
      return new File([new Uint8Array(header), new Uint8Array(Math.max(0, size - header.length))], name, { type })
    }

    async function choose(wrapper: Awaited<ReturnType<typeof mountWithRouter>>['wrapper'], file: File) {
      const input = wrapper.get('#logo')
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')
      await flushPromises()
    }

    const uploadButton = (wrapper: Awaited<ReturnType<typeof mountWithRouter>>['wrapper']) =>
      wrapper.findAll('button').find((b) => b.text() === 'Subir logo')!

    beforeEach(() => {
      URL.createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:logo')
      URL.revokeObjectURL = vi.fn<(url: string) => void>()
    })

    it('sube el logo tal cual, sin reducirlo, y muestra el avance', async () => {
      let report: ((fraction: number) => void) | undefined
      let finish: (value: CompanyDetail) => void = () => {}
      vi.mocked(companyApi.uploadLogo).mockImplementation((_file, options) => {
        report = options?.onProgress
        return new Promise((resolve) => (finish = resolve))
      })
      const { wrapper } = await mountWithRouter(CompanyView)
      const logo = pngFile('logo.png')

      await choose(wrapper, logo)
      await uploadButton(wrapper).trigger('click')
      report!(0.5)
      await flushPromises()

      expect(companyApi.uploadLogo).toHaveBeenCalledWith(logo, expect.any(Object))
      expect(wrapper.get('[data-test="logo-progress"]').text()).toContain('50 %')

      finish({ ...company, logo_url: 'https://img.test/logo.png' })
      await flushPromises()
      expect(wrapper.find('[data-test="logo-progress"]').exists()).toBe(false)
    })

    it('rechaza antes de subir un formato distinto de PNG o JPG, o más de 1 MB', async () => {
      const { wrapper } = await mountWithRouter(CompanyView)

      await choose(wrapper, new File(['GIF89a'], 'logo.gif', { type: 'image/gif' }))
      expect(wrapper.text()).toContain('El logo debe ser PNG o JPG.')
      expect(uploadButton(wrapper).attributes('disabled')).toBeDefined()

      await choose(wrapper, pngFile('logo.png', 1024 * 1024 + 1))
      expect(wrapper.text()).toContain('El logo no puede pesar más de 1 MB.')
      expect(uploadButton(wrapper).attributes('disabled')).toBeDefined()
      expect(companyApi.uploadLogo).not.toHaveBeenCalled()
    })

    it('muestra el 503 de la API si el almacenamiento falla', async () => {
      vi.mocked(companyApi.uploadLogo).mockRejectedValue(new ApiError(503, 'No se pudo guardar el logo. Inténtalo de nuevo.'))
      const { wrapper } = await mountWithRouter(CompanyView)

      await choose(wrapper, pngFile('logo.png'))
      await uploadButton(wrapper).trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('No se pudo guardar el logo. Inténtalo de nuevo.')
    })
  })
})
