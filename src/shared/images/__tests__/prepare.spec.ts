import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkLogo, ImageRejected, prepareProductPhoto, readImageInfo } from '../prepare'

/*
 * Spec 016 · F005 (RF-012, A-80, A-85): la app reduce la foto antes de subirla.
 * Formato por los primeros bytes, peso y megapíxeles por la cabecera antes de
 * decodificar, y un JPEG de 1600 px como máximo que no pase de 2 MB.
 */

const MB = 1024 * 1024

function u16be(n: number) {
  return [(n >> 8) & 0xff, n & 0xff]
}
function u32be(n: number) {
  return [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
function u16le(n: number) {
  return [n & 0xff, (n >> 8) & 0xff]
}
function u24le(n: number) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]
}
function ascii(text: string) {
  return Array.from(text, (c) => c.charCodeAt(0))
}

/** JPEG con un APP1 de relleno antes del SOF, como los de las cámaras (el EXIF va ahí). */
function jpeg(width: number, height: number, sof = 0xc0) {
  const app1 = [0xff, 0xe1, ...u16be(10), ...ascii('Exif'), 0, 0, 0, 0]
  const frame = [0xff, sof, ...u16be(17), 8, ...u16be(height), ...u16be(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]
  return [0xff, 0xd8, ...app1, ...frame, 0xff, 0xd9]
}

function png(width: number, height: number) {
  return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...u32be(13), ...ascii('IHDR'), ...u32be(width), ...u32be(height), 8, 6, 0, 0, 0]
}

function webp(chunk: 'VP8 ' | 'VP8L' | 'VP8X', width: number, height: number) {
  let data: number[]
  if (chunk === 'VP8 ') {
    // Etiqueta de cuadro (3 bytes), código de inicio y medidas de 14 bits.
    data = [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(width), ...u16le(height)]
  } else if (chunk === 'VP8L') {
    const bits = (width - 1) | ((height - 1) << 14)
    data = [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff]
  } else {
    data = [0x10, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)]
  }
  return [...ascii('RIFF'), ...u32be(0), ...ascii('WEBP'), ...ascii(chunk), ...u24le(data.length), 0, ...data]
}

function heic() {
  return [...u32be(24), ...ascii('ftypheic'), ...u32be(0), ...ascii('mif1heic')]
}

/** Archivo con esos bytes al principio y, si hace falta, relleno hasta `size`. */
function file(bytes: number[], name = 'foto.jpg', type = 'image/jpeg', size = bytes.length) {
  const parts: BlobPart[] = [new Uint8Array(bytes)]
  if (size > bytes.length) parts.push(new Uint8Array(size - bytes.length))
  return new File(parts, name, { type })
}

/* Canvas y decodificación simulados: jsdom no los tiene. */
const draw = { calls: [] as string[], fillStyle: '' }
const qualities: number[] = []
let blobSizes: number[] = []
const decode = vi.fn<(source: ImageBitmapSource, options?: ImageBitmapOptions) => Promise<ImageBitmap>>()
let canvasSize = { width: 0, height: 0 }

beforeEach(() => {
  draw.calls = []
  qualities.length = 0
  blobSizes = [400 * 1024]
  decode.mockReset()
  decode.mockImplementation(async () => ({ width: 4000, height: 3000, close: () => {} }) as ImageBitmap)
  vi.stubGlobal('createImageBitmap', decode)

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvasSize = { width: this.width, height: this.height }
    return {
      set fillStyle(value: string) {
        draw.fillStyle = value
      },
      fillRect: () => draw.calls.push('fillRect'),
      drawImage: () => draw.calls.push('drawImage'),
    } as unknown as CanvasRenderingContext2D
  } as never)

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type, quality) => {
    qualities.push(quality as number)
    const size = blobSizes[Math.min(qualities.length - 1, blobSizes.length - 1)]!
    callback(new Blob([new Uint8Array(size)], { type }))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('readImageInfo', () => {
  it.each([
    ['JPEG (SOF0)', jpeg(4000, 3000), 'jpeg'],
    ['JPEG progresivo (SOF2)', jpeg(4000, 3000, 0xc2), 'jpeg'],
    ['PNG (IHDR)', png(4000, 3000), 'png'],
    ['WebP con pérdida (VP8)', webp('VP8 ', 4000, 3000), 'webp'],
    ['WebP sin pérdida (VP8L)', webp('VP8L', 4000, 3000), 'webp'],
    ['WebP extendido (VP8X)', webp('VP8X', 4000, 3000), 'webp'],
  ])('lee formato y dimensiones de %s', async (_label, bytes, format) => {
    expect(await readImageInfo(file(bytes))).toEqual({ format, width: 4000, height: 3000 })
  })

  it('reconoce el formato por los bytes, no por el nombre', async () => {
    expect(await readImageInfo(file(png(10, 10), 'foto.jpg', 'image/jpeg'))).toMatchObject({ format: 'png' })
    expect(await readImageInfo(file(heic(), 'foto.jpg', 'image/jpeg'))).toBeNull()
  })
})

describe('prepareProductPhoto', () => {
  it('reduce una foto de 4000×3000 a 1600×1200 en JPEG, girada según su EXIF', async () => {
    const result = await prepareProductPhoto(file(jpeg(4000, 3000), 'IMG_0001.jpg'))

    expect(decode).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' })
    expect(canvasSize).toEqual({ width: 1600, height: 1200 })
    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('IMG_0001.jpg')
    expect(result.size).toBeLessThanOrEqual(2 * MB)
    expect(qualities).toEqual([0.85])
  })

  it('usa las medidas ya giradas: una vertical queda vertical', async () => {
    decode.mockResolvedValue({ width: 3000, height: 4000, close: () => {} } as ImageBitmap)

    await prepareProductPhoto(file(jpeg(4000, 3000)))
    expect(canvasSize).toEqual({ width: 1200, height: 1600 })
  })

  it('no agranda una foto chica', async () => {
    decode.mockResolvedValue({ width: 640, height: 480, close: () => {} } as ImageBitmap)

    await prepareProductPhoto(file(jpeg(640, 480)))
    expect(canvasSize).toEqual({ width: 640, height: 480 })
  })

  it('pinta fondo blanco antes de dibujar, para los PNG con transparencia', async () => {
    const result = await prepareProductPhoto(file(png(4000, 3000), 'producto.png', 'image/png'))

    expect(draw.fillStyle).toBe('#ffffff')
    expect(draw.calls).toEqual(['fillRect', 'drawImage'])
    expect(result.name).toBe('producto.jpg')
  })

  it('si pasa de 2 MB, lo intenta otra vez con calidad 0.7', async () => {
    blobSizes = [2.5 * MB, 1.25 * MB]

    const result = await prepareProductPhoto(file(jpeg(4000, 3000)))
    expect(qualities).toEqual([0.85, 0.7])
    expect(result.size).toBe(1.25 * MB)
  })

  it('si aún pasa de 2 MB, la rechaza', async () => {
    blobSizes = [3 * MB, 2.5 * MB]

    await expect(prepareProductPhoto(file(jpeg(4000, 3000)))).rejects.toThrow(ImageRejected)
  })

  it('rechaza HEIC por sus bytes aunque se llame .jpg, sin decodificar', async () => {
    const error = await prepareProductPhoto(file(heic(), 'IMG_0002.jpg')).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ImageRejected)
    expect((error as Error).message).toBe('Formato no admitido. Usa una foto JPG, PNG o WebP.')
    expect(decode).not.toHaveBeenCalled()
  })

  it('rechaza más de 10 MB sin decodificar y sugiere el modo normal', async () => {
    const error = await prepareProductPhoto(file(jpeg(4000, 3000), 'foto.jpg', 'image/jpeg', 10 * MB + 1)).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ImageRejected)
    expect((error as Error).message).toContain('modo normal')
    expect(decode).not.toHaveBeenCalled()
  })

  it('rechaza más de 50 MP por la cabecera, aunque pese poco, sin decodificar', async () => {
    const error = await prepareProductPhoto(file(jpeg(9248, 6936))).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ImageRejected)
    expect((error as Error).message).toContain('modo normal')
    expect(decode).not.toHaveBeenCalled()
  })

  it('una imagen que no se puede decodificar da «No se pudo leer la imagen»', async () => {
    decode.mockRejectedValue(new DOMException('The source image could not be decoded.', 'InvalidStateError'))

    await expect(prepareProductPhoto(file(jpeg(4000, 3000)))).rejects.toThrow('No se pudo leer la imagen.')
  })

  it('una cabecera ilegible también', async () => {
    await expect(prepareProductPhoto(file([0xff, 0xd8, 0xff]))).rejects.toThrow('No se pudo leer la imagen.')
  })
})

describe('checkLogo', () => {
  it('acepta PNG y JPEG de hasta 1 MB sin reducirlos', async () => {
    await expect(checkLogo(file(png(500, 200), 'logo.png', 'image/png', MB))).resolves.toBeUndefined()
    await expect(checkLogo(file(jpeg(500, 200), 'logo.jpg'))).resolves.toBeUndefined()
    expect(decode).not.toHaveBeenCalled()
  })

  it('rechaza otros formatos y más de 1 MB', async () => {
    await expect(checkLogo(file(webp('VP8X', 500, 200), 'logo.webp', 'image/webp'))).rejects.toThrow('El logo debe ser PNG o JPG.')
    await expect(checkLogo(file(png(500, 200), 'logo.png', 'image/png', MB + 1))).rejects.toThrow('El logo no puede pesar más de 1 MB.')
  })
})
