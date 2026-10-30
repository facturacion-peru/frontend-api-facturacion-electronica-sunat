import { describe, expect, it, vi } from 'vitest'

/*
 * Spec 017 · F002: rutas de locales.
 */
type Call = (path: string, init?: unknown) => Promise<unknown>
const client = vi.hoisted(() => ({ GET: vi.fn<Call>(), POST: vi.fn<Call>(), PATCH: vi.fn<Call>() }))
vi.mock('@/core/api/client', () => ({ apiClient: client }))

const { establishmentsApi } = await import('../api')

const ok = (data: unknown) => ({ data: { success: true, data }, response: new Response(null, { status: 200 }) })
const local = { id: 2, code: '0001', name: 'Sucursal', address: 'Jr. Unión 45', ubigeo: '150101' }

describe('establishmentsApi', () => {
  it('list pide los activos; con inactivos manda include_inactive=1 (la regla boolean no acepta «true»)', async () => {
    client.GET.mockResolvedValue(ok([local]))

    expect(await establishmentsApi.list()).toEqual([local])
    expect(client.GET).toHaveBeenLastCalledWith('/api/v1/establishments', { params: { query: {} } })

    await establishmentsApi.list(true)
    expect(client.GET).toHaveBeenLastCalledWith('/api/v1/establishments', { params: { query: { include_inactive: 1 } } })
  })

  it('create y update devuelven el local', async () => {
    client.POST.mockResolvedValue(ok(local))
    client.PATCH.mockResolvedValue(ok({ ...local, active: false }))

    expect(await establishmentsApi.create({ code: '0001', name: 'Sucursal', address: 'Jr. Unión 45', ubigeo: '150101' })).toEqual(local)
    expect(await establishmentsApi.update(2, { active: false })).toMatchObject({ active: false })
    expect(client.PATCH).toHaveBeenCalledWith('/api/v1/establishments/{establishment}', { params: { path: { establishment: 2 } }, body: { active: false } })
  })

  it('searchUbigeos usa el buscador de la empresa, no el de la plataforma', async () => {
    client.GET.mockResolvedValue(ok([{ id: '150101' }]))

    expect(await establishmentsApi.searchUbigeos('lima')).toEqual([{ id: '150101' }])
    expect(client.GET).toHaveBeenLastCalledWith('/api/v1/ubigeos/search', { params: { query: { q: 'lima' } } })
  })
})
