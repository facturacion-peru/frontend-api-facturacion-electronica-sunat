import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { ApiError } from '@/core/api/errors'
import { mountWithRouter } from '@/shared/testing/mountWithRouter'
import type { ImportPreview } from '../types'

type AsyncFn = (...args: unknown[]) => Promise<unknown>

vi.mock('../api', () => ({ dataTransferApi: { template: vi.fn<AsyncFn>(), preview: vi.fn<AsyncFn>(), confirm: vi.fn<AsyncFn>() } }))

const { dataTransferApi } = await import('../api')
const ImportWizard = (await import('../components/ImportWizard.vue')).default

const preview = (overrides: Partial<ImportPreview> = {}): ImportPreview => ({
  id: '9b1e0000-0000-0000-0000-000000000001',
  kind: 'products',
  mode: 'upsert',
  expires_at: '2026-10-07T10:30:00-05:00',
  can_confirm: true,
  summary: { rows: 3, create: 1, update: 1, unchanged: 1, errors: 0 },
  errors: [],
  warnings: [{ row: null, column: 'stock_actual', message: 'Columna de solo lectura: se ignora.' }],
  changes: [
    { row: 2, action: 'update', key: 'ACE-1', name: 'Aceite 1 l', fields: { precio_venta: { from: '3.50', to: '3.80' } } },
    { row: 4, action: 'create', key: 'ARR-1', name: 'Arroz 1 kg', stock: '20.000' },
  ],
  ...overrides,
})

const file = new File(['x'], 'productos.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

async function chooseFile(wrapper: Awaited<ReturnType<typeof mountWithRouter>>['wrapper']) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

async function reviewWith(result: ImportPreview, mode?: 'create' | 'upsert') {
  vi.mocked(dataTransferApi.preview).mockResolvedValue(result)
  const { wrapper } = await mountWithRouter(ImportWizard)
  if (mode) await wrapper.find(`input[name="import-mode"][value="${mode}"]`).setValue(true)
  await chooseFile(wrapper)
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: new Date('2026-10-07T15:05:00Z'), shouldAdvanceTime: true })
  vi.mocked(dataTransferApi.template).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('ImportWizard', () => {
  it('paso 1: plantilla del tipo elegido, archivo XLSX o CSV y «Solo crear» por defecto', async () => {
    const { wrapper } = await mountWithRouter(ImportWizard)

    await wrapper.findAll('button').find((b) => b.text() === 'Descargar plantilla')!.trigger('click')
    expect(dataTransferApi.template).toHaveBeenLastCalledWith('products')
    await wrapper.find('input[name="import-kind"][value="customers"]').setValue(true)
    await wrapper.findAll('button').find((b) => b.text() === 'Descargar plantilla')!.trigger('click')
    expect(dataTransferApi.template).toHaveBeenLastCalledWith('customers')

    expect(wrapper.find('input[type="file"]').attributes('accept')).toContain('.xlsx')
    expect(wrapper.find('input[type="file"]').attributes('accept')).toContain('text/csv')
    expect((wrapper.find('input[name="import-mode"][value="create"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('paso 2: envía el archivo y muestra resumen, cambios campo por campo y avisos', async () => {
    const wrapper = await reviewWith(preview(), 'upsert')

    expect(dataTransferApi.preview).toHaveBeenCalledWith('products', file, 'upsert')
    expect(wrapper.find('[data-test="import-summary"]').text()).toMatch(/1\s*nuevo.*1\s*con cambios.*1\s*sin cambios/s)
    const update = wrapper.find('[data-test="import-change-2"]')
    expect(update.text()).toContain('ACE-1')
    expect(update.text()).toContain('Precio de venta')
    expect(update.text()).toContain('3.50')
    expect(update.text()).toContain('3.80')
    expect(wrapper.find('[data-test="import-change-4"]').text()).toContain('Stock inicial: 20')
    expect(wrapper.text()).toContain('stock_actual: Columna de solo lectura: se ignora.')
  })

  it('con errores lista fila y columna y no deja confirmar', async () => {
    const wrapper = await reviewWith(preview({
      can_confirm: false,
      summary: { rows: 2, create: 1, update: 0, unchanged: 0, errors: 1 },
      errors: [{ row: 3, column: 'precio_venta', message: 'El campo precio_venta debe tener 0-2 cifras decimales.' }],
    }))

    expect(wrapper.find('[data-test="import-errors"]').text()).toContain('Fila 3 · precio_venta')
    expect(wrapper.findAll('button').find((b) => b.text() === 'Confirmar importación')!.attributes('disabled')).toBeDefined()
  })

  it('confirma con un diálogo y muestra el resultado', async () => {
    vi.mocked(dataTransferApi.confirm).mockResolvedValue({ created: 1, updated: 1, entries: 1 })
    const wrapper = await reviewWith(preview())

    await wrapper.findAll('button').find((b) => b.text() === 'Confirmar importación')!.trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Se creará 1 producto y se actualizará 1. ¿Continuar?')
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Sí, importar')!.click()
    await flushPromises()

    expect(dataTransferApi.confirm).toHaveBeenCalledWith('9b1e0000-0000-0000-0000-000000000001')
    expect(wrapper.find('[data-test="import-done"]').text()).toContain('1 creado, 1 actualizado y 1 con stock inicial')
  })

  it.each([
    [409, 'Los productos cambiaron desde la vista previa: vuelve a subir el archivo para revisarla de nuevo.'],
    [410, 'La vista previa caducó. Vuelve a subir el archivo.'],
  ])('un %i al confirmar vuelve al paso 1 con el mensaje', async (status, message) => {
    vi.mocked(dataTransferApi.confirm).mockRejectedValue(new ApiError(status, message))
    const wrapper = await reviewWith(preview())

    await wrapper.findAll('button').find((b) => b.text() === 'Confirmar importación')!.trigger('click')
    await flushPromises()
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Sí, importar')!.click()
    await flushPromises()

    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').text()).toContain(message)
  })

  it('una vista previa caducada no se puede confirmar', async () => {
    const wrapper = await reviewWith(preview())
    vi.setSystemTime(new Date('2026-10-07T15:31:00Z'))
    vi.advanceTimersByTime(30_000)
    await flushPromises()

    expect(wrapper.text()).toContain('La vista previa caducó')
    expect(wrapper.findAll('button').find((b) => b.text() === 'Confirmar importación')!.attributes('disabled')).toBeDefined()
  })

  it('muestra los cambios de 50 en 50', async () => {
    const changes = Array.from({ length: 120 }, (_, i) => ({ row: i + 2, action: 'create' as const, key: `P-${i}`, name: `Producto ${i}`, stock: null }))
    const wrapper = await reviewWith(preview({ changes, summary: { rows: 120, create: 120, update: 0, unchanged: 0, errors: 0 } }))

    expect(wrapper.findAll('[data-test^="import-change-"]')).toHaveLength(50)
    await wrapper.findAll('button').find((b) => b.text().startsWith('Mostrar más'))!.trigger('click')
    expect(wrapper.findAll('[data-test^="import-change-"]')).toHaveLength(100)
  })

  it('un error del archivo (422) se muestra sin salir del paso 1', async () => {
    vi.mocked(dataTransferApi.preview).mockRejectedValue(new ApiError(422, 'Los datos enviados no son válidos.', { file: ['Falta la columna «precio_venta». Usa la plantilla.'] }))
    const { wrapper } = await mountWithRouter(ImportWizard)
    await chooseFile(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Falta la columna «precio_venta»')
    expect(wrapper.find('input[type="file"]').exists()).toBe(true)
  })
})
