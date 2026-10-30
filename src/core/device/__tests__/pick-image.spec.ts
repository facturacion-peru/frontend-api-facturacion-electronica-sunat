import { afterEach, describe, expect, it, vi } from 'vitest'

import { pickWithInput } from '../pick-image'

/*
 * Spec 016 · F007 (RF-011): la foto se elige con un <input type="file">
 * temporal. F002 comprobó en Android que la cámara solo se abre con `capture`
 * y `accept="image/*"`, y que cancelar emite `cancel`.
 */

/** Intercepta el click del <input> que crea pickWithInput y lo devuelve. */
function captureInput() {
  const clicked = vi.fn<(input: HTMLInputElement) => void>()
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
    clicked(this)
  })
  return () => clicked.mock.calls[0]![0]
}

function choose(input: HTMLInputElement, file: File | null) {
  Object.defineProperty(input, 'files', { value: file ? [file] : [] })
  input.dispatchEvent(new Event('change'))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pickWithInput', () => {
  it('cámara: accept image/* y capture="environment"', async () => {
    const input = captureInput()
    const promise = pickWithInput('camera')

    expect(input().accept).toBe('image/*')
    expect(input().getAttribute('capture')).toBe('environment')

    const photo = new File(['jpeg'], 'JPEG_1.jpg', { type: 'image/jpeg' })
    choose(input(), photo)
    await expect(promise).resolves.toBe(photo)
  })

  it('galería: los tres formatos y sin capture', async () => {
    const input = captureInput()
    const promise = pickWithInput('gallery')

    expect(input().accept).toBe('image/jpeg,image/png,image/webp')
    expect(input().hasAttribute('capture')).toBe(false)

    choose(input(), new File(['png'], 'foto.png', { type: 'image/png' }))
    await expect(promise).resolves.toMatchObject({ name: 'foto.png' })
  })

  it('cancelar (o «Atrás» en Android) devuelve null', async () => {
    const input = captureInput()
    const promise = pickWithInput('gallery')

    input().dispatchEvent(new Event('cancel'))
    await expect(promise).resolves.toBeNull()
  })

  it('no deja el <input> en la página', async () => {
    const input = captureInput()
    const promise = pickWithInput('camera')

    expect(document.body.contains(input())).toBe(true)
    choose(input(), null)

    await expect(promise).resolves.toBeNull()
    expect(document.body.querySelector('input[type="file"]')).toBeNull()
  })
})
