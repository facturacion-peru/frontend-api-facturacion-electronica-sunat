import { afterEach, describe, expect, it, vi } from 'vitest'

/*
 * Spec 013 · T012: las descargas (PDF, XML, CDR) se entregan por el módulo
 * de dispositivo: «Compartir» en la app Android, enlace en la web.
 */
const deliverFile = vi.hoisted(() => vi.fn<(blob: Blob, filename: string, options?: { open?: boolean }) => Promise<void>>())

vi.mock('@/core/device', () => ({ device: () => ({ isNative: true, appVersion: '0.2.0', deliverFile }) }))

const { downloadFile } = await import('../download')

afterEach(() => vi.unstubAllGlobals())

describe('downloadFile', () => {
  it('pide el archivo con el token y la versión de la app, y lo entrega al dispositivo', async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response(new Blob(['%PDF']), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await downloadFile('/api/v1/tickets/9/pdf', 'T-000009-80mm.pdf', { open: true })

    const headers = fetchMock.mock.calls[0]![1].headers as Record<string, string>
    expect(headers['X-App-Version']).toBe('0.2.0')
    expect(deliverFile).toHaveBeenCalledWith(expect.any(Blob), 'T-000009-80mm.pdf', { open: true })
  })
})
