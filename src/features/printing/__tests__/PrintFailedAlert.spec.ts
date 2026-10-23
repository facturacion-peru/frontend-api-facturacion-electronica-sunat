import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { PrintFailure } from '../composables/usePrinting'

/* Spec 015 · T025 (HU-4, RF-005): el aviso de fallo y sus salidas. */
type AsyncFn = (...args: unknown[]) => Promise<unknown>

const requestEnable = vi.hoisted(() => vi.fn<AsyncFn>())
vi.mock('@/core/device', () => ({ device: () => ({ isNative: true, printer: { available: true, requestEnable } }) }))

const PrintFailedAlert = (await import('../components/PrintFailedAlert.vue')).default

async function mountAlert(failure: PrintFailure, props: Record<string, unknown> = {}) {
  const onRetry = vi.fn<() => void>()
  const onShare = vi.fn<() => void>()
  const Host = defineComponent(() => () => h(PrintFailedAlert, { failure, ...props, onRetry, onShare }))
  const { wrapper } = await mountWithRouter(Host)
  return { wrapper, onRetry, onShare }
}

const buttonOf = (wrapper: Awaited<ReturnType<typeof mountAlert>>['wrapper'], label: string) =>
  wrapper.findAll('button').find((b) => b.text() === label)

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('aviso de impresión fallida', () => {
  it('muestra el motivo, «Reintentar» y «Compartir PDF»', async () => {
    const { wrapper, onRetry, onShare } = await mountAlert({ code: 'connect_failed', message: 'No se pudo conectar con la impresora.' })

    expect(wrapper.text()).toContain('No se imprimió')
    expect(wrapper.text()).toContain('No se pudo conectar con la impresora.')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    await buttonOf(wrapper, 'Reintentar')!.trigger('click')
    await buttonOf(wrapper, 'Compartir PDF')!.trigger('click')
    expect(onRetry).toHaveBeenCalled()
    expect(onShare).toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Elegir otra impresora')
  })

  it.each(['not_paired', 'permission_denied'] as const)('con %s ofrece elegir otra impresora', async (code) => {
    const { wrapper } = await mountAlert({ code, message: 'x' })

    expect(wrapper.find('a').text()).toBe('Elegir otra impresora')
    expect(wrapper.find('a').attributes('href')).toContain('__printer')
  })

  it('con el Bluetooth apagado, «Encender Bluetooth» lo pide y reintenta si se encendió', async () => {
    requestEnable.mockResolvedValue(true)
    const { wrapper, onRetry } = await mountAlert({ code: 'bluetooth_off', message: 'El Bluetooth del teléfono está apagado.' })

    await buttonOf(wrapper, 'Encender Bluetooth')!.trigger('click')
    await flushPromises()

    expect(requestEnable).toHaveBeenCalled()
    expect(onRetry).toHaveBeenCalled()
  })

  it('si no se enciende, no reintenta', async () => {
    requestEnable.mockResolvedValue(false)
    const { wrapper, onRetry } = await mountAlert({ code: 'bluetooth_off', message: 'x' })

    await buttonOf(wrapper, 'Encender Bluetooth')!.trigger('click')
    await flushPromises()

    expect(onRetry).not.toHaveBeenCalled()
  })

  it('sin PDF (hoja de prueba) no ofrece «Compartir PDF»', async () => {
    const { wrapper } = await mountAlert({ code: 'connect_failed', message: 'x' }, { canShare: false })

    expect(buttonOf(wrapper, 'Compartir PDF')).toBeUndefined()
  })
})
