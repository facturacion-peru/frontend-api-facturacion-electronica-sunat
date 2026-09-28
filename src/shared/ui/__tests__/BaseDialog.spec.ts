import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'

import BaseDialog from '../BaseDialog.vue'

const Host = defineComponent({
  components: { BaseDialog },
  setup: () => ({ open: ref(false) }),
  template: `
    <button id="opener" @click="open = true">Abrir</button>
    <BaseDialog v-model:open="open" title="Invitar usuario">
      <input id="first" />
      <template #actions>
        <button id="last">Guardar</button>
      </template>
    </BaseDialog>
  `,
})

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

async function openDialog() {
  wrapper = mount(Host, { attachTo: document.body })
  const opener = document.getElementById('opener')!
  opener.focus()
  opener.click()
  await nextTick()
  await nextTick()
}

function press(key: string, shiftKey = false) {
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }))
}

describe('BaseDialog', () => {
  it('se anuncia como diálogo modal con su título', async () => {
    await openDialog()
    const dialog = document.querySelector('[role="dialog"]')!

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Invitar usuario')
  })

  it('lleva el foco al primer control al abrirse', async () => {
    await openDialog()

    expect(document.activeElement?.id).toBe('first')
  })

  it('atrapa el foco con Tab y Shift+Tab', async () => {
    await openDialog()
    document.getElementById('last')!.focus()

    press('Tab')
    expect(document.activeElement?.id).toBe('first')

    press('Tab', true)
    expect(document.activeElement?.id).toBe('last')
  })

  it('se cierra con Escape y devuelve el foco a quien lo abrió', async () => {
    await openDialog()

    press('Escape')
    await nextTick()
    await nextTick()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement?.id).toBe('opener')
  })
})
