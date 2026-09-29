import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { SunatSettings, SunatStatusInfo } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({
  sunatApi: {
    status: vi.fn<AsyncFn>(),
    settings: vi.fn<AsyncFn>(),
    updateCredentials: vi.fn<AsyncFn>(),
    uploadCertificate: vi.fn<AsyncFn>(),
    validate: vi.fn<AsyncFn>(),
  },
}))

const { sunatApi } = await import('../api')
const SunatView = (await import('../views/SunatView.vue')).default

const certificate = {
  subject: 'CN=BODEGA ANA', ruc: '20131312955', valid_from: '2026-01-01T00:00:00+00:00',
  valid_to: '2027-01-01T00:00:00+00:00', days_to_expire: 90, uploaded_by: 'Ana',
}

const empty: SunatSettings = {
  company_id: 7, environment: 'beta', environment_label: 'Pruebas (beta) — sin valor legal', status: 'not_configured',
  status_label: 'No configurada', sol_user_masked: null, has_sol_password: false, sol_verified: false, certificate: null,
  certificates_history: [], last_validated_at: null, last_validation_error: null,
}

const configured: SunatSettings = {
  ...empty, status: 'pending', status_label: 'Pendiente de validación', sol_user_masked: 'VE****01', has_sol_password: true,
  certificate, certificates_history: [{ ...certificate, status: 'current', replaced_at: null }],
}

const status = (over: Partial<SunatStatusInfo> = {}): SunatStatusInfo => ({
  environment: 'beta', environment_label: 'Pruebas (beta) — sin valor legal', status: 'pending', status_label: 'Pendiente de validación',
  reason: null, can_issue: false, missing: [], sol_verified: false, certificate_days_to_expire: 90, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(sunatApi.settings).mockResolvedValue(configured)
  vi.mocked(sunatApi.status).mockResolvedValue(status())
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SunatView', () => {
  it('muestra siempre el distintivo de pruebas', async () => {
    const { wrapper } = await mountWithRouter(SunatView)

    expect(wrapper.find('[data-test="environment-badge"]').text()).toBe('PRUEBAS — sin valor legal')
  })

  it('sin configurar, dice qué falta', async () => {
    vi.mocked(sunatApi.settings).mockResolvedValue(empty)
    vi.mocked(sunatApi.status).mockResolvedValue(
      status({ status: 'not_configured', missing: ['Registra el usuario y la clave SOL.', 'Sube el certificado digital.'] }),
    )
    const { wrapper } = await mountWithRouter(SunatView)

    expect(wrapper.find('[data-test="status"]').text()).toContain('No configurada')
    expect(wrapper.find('[data-test="missing"]').text()).toContain('Sube el certificado digital.')
  })

  it('nunca muestra la clave SOL: solo el usuario enmascarado y «registrada»', async () => {
    const { wrapper } = await mountWithRouter(SunatView)

    expect(wrapper.find('[data-test="sol-summary"]').text()).toContain('VE****01')
    expect(wrapper.find('[data-test="sol-summary"]').text()).toContain('registrada')
    expect((wrapper.find('#sol_password').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('#sol_password').attributes('type')).toBe('password')
  })

  it('avisa que en beta la clave SOL real no está verificada', async () => {
    const { wrapper } = await mountWithRouter(SunatView)

    expect(wrapper.find('[data-test="sol-unverified"]').text()).toContain('no verificada')
  })

  it('guarda las credenciales y vacía el formulario', async () => {
    vi.mocked(sunatApi.updateCredentials).mockResolvedValue(configured)
    const { wrapper } = await mountWithRouter(SunatView)

    await wrapper.find('#sol_user').setValue('VENTAS01')
    await wrapper.find('#sol_password').setValue('secreto')
    await wrapper.find('#sol_password').element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(sunatApi.updateCredentials).toHaveBeenCalledWith({ sol_user: 'VENTAS01', sol_password: 'secreto' })
    expect((wrapper.find('#sol_password').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('Credenciales SOL guardadas.')
  })

  it('muestra los metadatos del certificado vigente', async () => {
    const { wrapper } = await mountWithRouter(SunatView)

    expect(wrapper.find('[data-test="certificate"]').text()).toContain('CN=BODEGA ANA')
    expect(wrapper.find('[data-test="certificate"]').text()).toContain('20131312955')
  })

  it('sube el certificado con su contraseña', async () => {
    vi.mocked(sunatApi.uploadCertificate).mockResolvedValue(configured)
    const { wrapper } = await mountWithRouter(SunatView)
    const file = new File(['x'], 'cert.pfx')

    const input = wrapper.find('#certificate')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await wrapper.find('#certificate_password').setValue('clave-cert')
    await input.element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(sunatApi.uploadCertificate).toHaveBeenCalledWith(file, 'clave-cert')
    expect(wrapper.text()).toContain('Certificado guardado.')
  })

  it('muestra el motivo si el certificado es rechazado', async () => {
    vi.mocked(sunatApi.uploadCertificate).mockRejectedValue(
      new ApiError(422, 'x', { certificate: ['La contraseña del certificado es incorrecta.'] }),
    )
    const { wrapper } = await mountWithRouter(SunatView)

    const input = wrapper.find('#certificate')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'cert.pfx')] })
    await input.trigger('change')
    await input.element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(wrapper.find('#certificate-error').text()).toBe('La contraseña del certificado es incorrecta.')
  })

  it('al validar con éxito muestra el nuevo estado', async () => {
    vi.mocked(sunatApi.validate).mockResolvedValue({ ...configured, status: 'validated', status_label: 'Validada' })
    const { wrapper } = await mountWithRouter(SunatView)

    await wrapper.findAll('button').find((b) => b.text() === 'Validar')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="status"]').text()).toContain('Validada')
    expect(wrapper.text()).toContain('Configuración validada')
  })

  it('al validar sin datos lista lo que falta', async () => {
    vi.mocked(sunatApi.validate).mockRejectedValue(
      new ApiError(422, 'x', { configuration: ['Registra el usuario y la clave SOL.'] }),
    )
    const { wrapper } = await mountWithRouter(SunatView)

    await wrapper.findAll('button').find((b) => b.text() === 'Validar')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="validate-errors"]').text()).toContain('Registra el usuario y la clave SOL.')
  })

  it('si SUNAT no responde lo dice sin marcar error', async () => {
    vi.mocked(sunatApi.validate).mockRejectedValue(new ApiError(503, 'SUNAT no responde en este momento. Inténtalo más tarde.'))
    const { wrapper } = await mountWithRouter(SunatView)

    await wrapper.findAll('button').find((b) => b.text() === 'Validar')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('SUNAT no responde')
    expect(wrapper.find('[data-test="status"]').text()).toContain('Pendiente de validación')
  })

  it('muestra el historial cuando hubo reemplazos', async () => {
    vi.mocked(sunatApi.settings).mockResolvedValue({
      ...configured,
      certificates_history: [
        { ...certificate, status: 'current', replaced_at: null },
        { ...certificate, valid_to: '2026-06-01T00:00:00+00:00', status: 'replaced', replaced_at: '2026-09-01T10:00:00+00:00' },
      ],
    })
    const { wrapper } = await mountWithRouter(SunatView)

    const history = wrapper.find('[data-test="history"]').text()
    expect(history).toContain('Vigente')
    expect(history).toContain('Reemplazado')
  })
})
