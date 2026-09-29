import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

const Stub = { template: '<div />' }

/** Nombres de ruta que las vistas usan para navegar; en pruebas son stubs. */
const namedStubs: RouteRecordRaw[] = [
  'home',
  'login',
  'forgot-password',
  'reset-password',
  'company',
  'users',
  'audit',
  'products',
  'product-create',
  'product-detail',
  'product-edit',
  'stock-entry',
  'inventory-alerts',
].map((name) => ({ path: `/__${name}/:id?`, name, component: Stub }))

/**
 * Monta una vista con Pinia y un router en memoria ubicado en `path`.
 * Utilidad solo para pruebas.
 */
export async function mountWithRouter(view: Component, { path = '/', pattern = '/' } = {}) {
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: pattern, component: view }, ...namedStubs],
  })

  await router.push(path)
  await router.isReady()

  const wrapper = mount(view, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()

  return { wrapper, router }
}
