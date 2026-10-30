/**
 * Preparar imágenes antes de subirlas (spec 016, RF-012, A-80, A-85).
 *
 * La foto de un producto se reduce en el dispositivo a un JPEG de 1600 px
 * como máximo: así la subida pesa unos cientos de KB y no lleva EXIF ni GPS
 * (el canvas no los copia). Antes de decodificar se revisan el formato por los
 * primeros bytes, el peso y los megapíxeles por la cabecera: decodificar una
 * foto de 64 MP ocupa unos 250 MB y puede colgar un celular de gama baja.
 * El logo no se reduce (perdería la transparencia): solo se valida.
 */

const MB = 1024 * 1024
const MAX_ORIGINAL_BYTES = 10 * MB
const MAX_ORIGINAL_PIXELS = 50_000_000
const MAX_UPLOAD_BYTES = 2 * MB
const MAX_SIDE = 1600
const QUALITIES = [0.85, 0.7]
const MAX_LOGO_BYTES = MB
/** Los segmentos APP de un JPEG (EXIF, miniatura) van antes del SOF y miden hasta 64 KB cada uno. */
const HEADER_BYTES = 512 * 1024

const FORMAT_MESSAGE = 'Formato no admitido. Usa una foto JPG, PNG o WebP.'
const TOO_BIG_MESSAGE = 'La foto es demasiado grande. Tómala en el modo normal de la cámara, no en el de máxima resolución.'
const UNREADABLE_MESSAGE = 'No se pudo leer la imagen.'

/** La imagen no se puede subir; el mensaje es para mostrarlo tal cual. */
export class ImageRejected extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageRejected'
  }
}

export type ImageFormat = 'jpeg' | 'png' | 'webp'

export interface ImageInfo {
  format: ImageFormat
  width: number
  height: number
}

/** Formato y medidas leídos de la cabecera, sin decodificar. null si no es JPEG, PNG ni WebP. */
export async function readImageInfo(file: Blob): Promise<ImageInfo | null> {
  const bytes = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer())

  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegInfo(bytes)
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return pngInfo(bytes)
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return webpInfo(bytes)

  return null
}

/** Valida y reduce la foto de un producto; lanza ImageRejected con el motivo. */
export async function prepareProductPhoto(file: File): Promise<File> {
  if (file.size > MAX_ORIGINAL_BYTES) throw new ImageRejected(TOO_BIG_MESSAGE)

  const info = await readImageInfo(file)
  if (!info) {
    // Empieza como una imagen admitida pero la cabecera no se entiende.
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
    throw new ImageRejected(head[0] === 0xff && head[1] === 0xd8 ? UNREADABLE_MESSAGE : FORMAT_MESSAGE)
  }
  if (info.width <= 0 || info.height <= 0) throw new ImageRejected(UNREADABLE_MESSAGE)
  if (info.width * info.height > MAX_ORIGINAL_PIXELS) throw new ImageRejected(TOO_BIG_MESSAGE)

  let bitmap: ImageBitmap
  try {
    // Gira según el EXIF: los píxeles quedan derechos y el EXIF no pasa al JPEG.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageRejected(UNREADABLE_MESSAGE)
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const context = canvas.getContext('2d')
    if (!context) throw new ImageRejected(UNREADABLE_MESSAGE)
    // JPEG no tiene transparencia: el fondo de un PNG queda blanco, no negro.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    for (const quality of QUALITIES) {
      const blob = await toJpeg(canvas, quality)
      if (blob.size <= MAX_UPLOAD_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]*$/, '') + '.jpg', { type: 'image/jpeg' })
      }
    }

    throw new ImageRejected('La foto sigue siendo demasiado grande después de reducirla. Prueba con otra.')
  } finally {
    bitmap.close()
  }
}

/** El logo se sube tal cual (PNG o JPEG, hasta 1 MB, A-80); lanza ImageRejected si no cumple. */
export async function checkLogo(file: File): Promise<void> {
  const info = await readImageInfo(file)
  if (!info || info.format === 'webp') throw new ImageRejected('El logo debe ser PNG o JPG.')
  if (file.size > MAX_LOGO_BYTES) throw new ImageRejected('El logo no puede pesar más de 1 MB.')
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageRejected(UNREADABLE_MESSAGE))), 'image/jpeg', quality)
  })
}

function jpegInfo(bytes: Uint8Array): ImageInfo | null {
  let offset = 2

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]!

    // Relleno (0xFF repetidos) y marcadores sin longitud.
    if (marker === 0xff) {
      offset += 1
      continue
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return null

    const length = u16be(bytes, offset + 2)
    // SOF0–SOF15, salvo DHT (C4), JPG (C8) y DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (offset + 9 > bytes.length) return null
      return { format: 'jpeg', height: u16be(bytes, offset + 5), width: u16be(bytes, offset + 7) }
    }

    offset += 2 + length
  }

  return null
}

function pngInfo(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== 'IHDR') return null
  return { format: 'png', width: u32be(bytes, 16), height: u32be(bytes, 20) }
}

function webpInfo(bytes: Uint8Array): ImageInfo | null {
  const chunk = ascii(bytes, 12, 4)
  const data = 20

  if (chunk === 'VP8 ' && bytes.length >= data + 10) {
    return { format: 'webp', width: u16le(bytes, data + 6) & 0x3fff, height: u16le(bytes, data + 8) & 0x3fff }
  }
  if (chunk === 'VP8L' && bytes.length >= data + 5) {
    const bits = (bytes[data + 1]! | (bytes[data + 2]! << 8) | (bytes[data + 3]! << 16) | (bytes[data + 4]! << 24)) >>> 0
    return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X' && bytes.length >= data + 10) {
    return { format: 'webp', width: u24le(bytes, data + 4) + 1, height: u24le(bytes, data + 7) + 1 }
  }

  return null
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, i) => bytes[i] === value)
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!
}

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8)
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)
}
