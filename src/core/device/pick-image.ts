export type ImageSource = 'camera' | 'gallery'

/**
 * Abre la cámara o la galería con un `<input type="file">` temporal; null si
 * el usuario cancela (spec 016, F002).
 *
 * En Android el WebView de Capacitor atiende el `<input>`: con `capture` abre
 * la cámara del sistema **solo si `accept` incluye `image/*`**; sin `capture`,
 * el selector de fotos. El formato real lo revisa luego `prepareProductPhoto`.
 * En la computadora el navegador ignora `capture` y abre el selector de archivos.
 */
export function pickWithInput(source: ImageSource): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.hidden = true

    if (source === 'camera') {
      input.accept = 'image/*'
      input.setAttribute('capture', 'environment')
    } else {
      input.accept = 'image/jpeg,image/png,image/webp'
    }

    const finish = (file: File | null) => {
      input.remove()
      resolve(file)
    }

    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => finish(null), { once: true })

    document.body.append(input)
    input.click()
  })
}
