import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Spec 016 · F004: subida multipart con avance (HU-1, esc. 8). Va con XHR
 * porque fetch no informa el avance de lo enviado; por lo demás se comporta
 * como el cliente: mismas cabeceras, ApiError y reacción a 401 y 426.
 */
vi.mock('@/core/device', () => ({ device: () => ({ isNative: true, appVersion: '0.3.0' }) }))
vi.mock('@/core/config/env', () => ({ env: { apiBaseUrl: 'http://api.test', appName: 'Prueba' } }))

/** XHR mínimo: guarda lo enviado y deja responder, avanzar o fallar a mano. */
class FakeXhr {
  static last: FakeXhr
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: unknown = null
  status = 0
  responseText = ''
  aborted = false
  upload = { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor() {
    FakeXhr.last = this
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }

  send(body: unknown) {
    this.body = body
  }

  abort() {
    this.aborted = true
    this.onabort?.()
  }

  respond(status: number, body: unknown) {
    this.status = status
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body)
    this.onload?.()
  }
}

vi.stubGlobal('XMLHttpRequest', FakeXhr)

const { uploadForm, UploadCancelled } = await import('../upload')
const { ApiError } = await import('../errors')
const { updateRequired } = await import('../app-update')
const { getToken, setToken } = await import('../token-storage')

function form() {
  const data = new FormData()
  data.append('image', new Blob(['jpeg']), 'foto.jpg')
  return data
}

beforeEach(() => {
  localStorage.clear()
  updateRequired.value = null
})

describe('uploadForm', () => {
  it('envía el FormData por POST con el token, Accept y la versión de la app', async () => {
    setToken('1|abc')
    const data = form()
    const promise = uploadForm('/api/v1/products/7/image', data)
    const xhr = FakeXhr.last

    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('http://api.test/api/v1/products/7/image')
    expect(xhr.body).toBe(data)
    expect(xhr.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer 1|abc', 'X-App-Version': '0.3.0' })
    // Sin Content-Type: el navegador pone el boundary del multipart.
    expect(xhr.headers['Content-Type']).toBeUndefined()

    xhr.respond(200, { success: true, data: { id: 7 } })
    await expect(promise).resolves.toEqual({ success: true, data: { id: 7 } })
  })

  it('informa el avance de lo enviado, de 0 a 1', async () => {
    const onProgress = vi.fn<(fraction: number) => void>()
    const promise = uploadForm('/api/v1/products/7/image', form(), { onProgress })
    const xhr = FakeXhr.last

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 250, total: 1000 })
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 10, total: 0 })
    xhr.respond(200, { success: true, data: {} })
    await promise

    expect(onProgress.mock.calls).toEqual([[0.25], [1]])
  })

  it('un 422 llega como ApiError con los errores del campo', async () => {
    const promise = uploadForm('/api/v1/products/7/image', form())
    FakeXhr.last.respond(422, { success: false, message: 'Datos inválidos', errors: { image: ['Formato no admitido.'] } })

    const error = await promise.catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as InstanceType<typeof ApiError>).status).toBe(422)
    expect((error as InstanceType<typeof ApiError>).field('image')).toBe('Formato no admitido.')
  })

  it('un 503 llega como error general con el mensaje de la API', async () => {
    const promise = uploadForm('/api/v1/products/7/image', form())
    FakeXhr.last.respond(503, { success: false, message: 'No se pudo guardar la foto. Inténtalo de nuevo.' })

    await expect(promise).rejects.toMatchObject({ status: 503, message: 'No se pudo guardar la foto. Inténtalo de nuevo.', fieldErrors: {} })
  })

  it('una respuesta que no es JSON da un mensaje genérico', async () => {
    const promise = uploadForm('/api/v1/products/7/image', form())
    FakeXhr.last.respond(502, '<html>Bad gateway</html>')

    await expect(promise).rejects.toMatchObject({ status: 502, message: 'Ocurrió un error inesperado.' })
  })

  it('sin red llega como ApiError con status 0', async () => {
    const promise = uploadForm('/api/v1/products/7/image', form())
    FakeXhr.last.onerror?.()

    await expect(promise).rejects.toMatchObject({ status: 0, message: expect.stringContaining('No se pudo conectar') })
  })

  it('un 401 descarta el token', async () => {
    setToken('1|abc')
    const promise = uploadForm('/api/v1/products/7/image', form())
    FakeXhr.last.respond(401, { success: false, message: 'No autenticado.' })

    await expect(promise).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
  })

  it('un 426 pide actualizar sin borrar la sesión', async () => {
    setToken('1|abc')
    const promise = uploadForm('/api/v1/products/7/image', form())
    FakeXhr.last.respond(426, { success: false, message: 'Actualízala', min_version: '0.4.0' })

    await expect(promise).rejects.toBeInstanceOf(ApiError)
    expect(updateRequired.value).toBe('0.4.0')
    expect(getToken()).toBe('1|abc')
  })

  it('al abortar corta la subida y rechaza con UploadCancelled, no con ApiError', async () => {
    const controller = new AbortController()
    const promise = uploadForm('/api/v1/products/7/image', form(), { signal: controller.signal })
    const xhr = FakeXhr.last

    controller.abort()

    expect(xhr.aborted).toBe(true)
    await expect(promise).rejects.toBeInstanceOf(UploadCancelled)
  })

  it('con la señal ya abortada no envía nada', async () => {
    const controller = new AbortController()
    controller.abort()
    FakeXhr.last = undefined as never

    await expect(uploadForm('/api/v1/products/7/image', form(), { signal: controller.signal })).rejects.toBeInstanceOf(UploadCancelled)
    expect(FakeXhr.last).toBeUndefined()
  })
})
