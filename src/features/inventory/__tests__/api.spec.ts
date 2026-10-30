import { describe, expect, it, vi } from 'vitest'

/*
 * Spec 016 · F010: la foto se sube y se quita con rutas propias, aparte de
 * guardar el producto (RF-010). La subida va con avance (uploadForm).
 */
const uploadForm = vi.hoisted(() => vi.fn<(path: string, form: FormData, options?: unknown) => Promise<unknown>>())
vi.mock('@/core/api/upload', () => ({ uploadForm }))

const DELETE = vi.hoisted(() => vi.fn<(path: string, init: unknown) => Promise<unknown>>())
vi.mock('@/core/api/client', () => ({ apiClient: { DELETE } }))

const { inventoryApi } = await import('../api')

const product = { id: 7, name: 'Arroz', image: { url: 'https://img.test/a.webp', thumb_url: 'https://img.test/a-thumb.webp' } }

describe('foto del producto', () => {
  it('uploadImage manda la foto en el campo image y devuelve el producto', async () => {
    uploadForm.mockResolvedValue({ success: true, data: product })
    const photo = new File(['jpeg'], 'foto.jpg', { type: 'image/jpeg' })
    const options = { onProgress: () => {} }

    expect(await inventoryApi.uploadImage(7, photo, options)).toEqual(product)

    const [path, form, passed] = uploadForm.mock.calls[0]!
    expect(path).toBe('/api/v1/products/7/image')
    expect(form.get('image')).toBe(photo)
    expect(passed).toBe(options)
  })

  it('removeImage usa DELETE y devuelve el producto sin foto', async () => {
    DELETE.mockResolvedValue({ data: { success: true, data: { ...product, image: null } }, response: new Response(null, { status: 200 }) })

    expect(await inventoryApi.removeImage(7)).toMatchObject({ id: 7, image: null })
    expect(DELETE).toHaveBeenCalledWith('/api/v1/products/{product}/image', { params: { path: { product: 7 } } })
  })
})
