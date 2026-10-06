import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import BaseDialog from '@/shared/ui/BaseDialog.vue'

/*
 * Spec 013 · T014, RF-005: el botón «Atrás» de Android cierra primero el
 * diálogo u hoja abierta; si no hay, vuelve de pantalla; en el Inicio o el
 * login, manda la app al fondo (la venta en curso queda guardada).
 */
const native = vi.hoisted(() => ({ handler: null as null | (() => void), minimize: vi.fn<() => Promise<void>>() }))

vi.mock('@/core/device', () => ({
  device: () => ({
    isNative: true,
    onBackButton: (fn: () => void) => {
      native.handler = fn
      return () => (native.handler = null)
    },
    minimize: native.minimize,
  }),
}))

const { installBackButton } = await import('../back-button')

const Stub = { template: '<div />' }
function makeRouter() {
  // Historial del navegador limpio para cada prueba (jsdom lo conserva).
  window.history.replaceState(null, '', '/')
  return createRouter({
    history: createWebHistory(),
    routes: ['home', 'login', 'new-sale', 'tickets'].map((name) => ({ path: name === 'home' ? '/' : `/${name}`, name, component: Stub })),
  })
}
const back = async () => {
  native.handler!()
  // jsdom resuelve history.go(-1) en una tarea aparte (popstate).
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

let uninstall: () => void
beforeEach(() => native.minimize.mockReset())
afterEach(() => {
  uninstall?.()
  document.body.innerHTML = ''
})

describe('botón «Atrás» de Android', () => {
  it('cierra primero el diálogo abierto más reciente, sin navegar', async () => {
    const router = makeRouter()
    await router.push('/new-sale')
    uninstall = installBackButton(router)
    const first = ref(true)
    const second = ref(true)
    mount(
      defineComponent(() => () => [
        h(BaseDialog, { title: 'Carrito', open: first.value, 'onUpdate:open': (v: boolean) => (first.value = v) }),
        h(BaseDialog, { title: '¿Vaciar?', open: second.value, 'onUpdate:open': (v: boolean) => (second.value = v) }),
      ]),
      { attachTo: document.body },
    )
    await flushPromises()

    await back()
    expect([first.value, second.value]).toEqual([true, false])
    await back()
    expect([first.value, second.value]).toEqual([false, false])
    expect(router.currentRoute.value.name).toBe('new-sale')
  })

  it('sin diálogos, vuelve a la pantalla anterior', async () => {
    const router = makeRouter()
    await router.push('/')
    await router.push('/tickets')
    uninstall = installBackButton(router)

    await back()
    expect(router.currentRoute.value.name).toBe('home')
    expect(native.minimize).not.toHaveBeenCalled()
  })

  it.each(['/', '/login'])('en %s manda la app al fondo', async (path) => {
    const router = makeRouter()
    await router.push('/tickets')
    await router.push(path)
    uninstall = installBackButton(router)

    await back()
    expect(native.minimize).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe(path)
  })

  it('en una pantalla abierta sin historial (p. ej. al iniciar), manda la app al fondo', async () => {
    const router = makeRouter()
    await router.push('/new-sale')
    uninstall = installBackButton(router)

    await back()
    expect(native.minimize).toHaveBeenCalled()
  })
})
