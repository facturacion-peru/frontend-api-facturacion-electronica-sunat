import { computed, readonly, ref } from 'vue'

/**
 * Tema claro u oscuro (spec 010, HU-5, A-55). La preferencia «Sistema» sigue
 * al dispositivo; «Claro» y «Oscuro» se recuerdan en este dispositivo.
 *
 * Siempre deja `data-theme="light|dark"` en <html>: así `main.css` tiene un
 * solo bloque de tokens oscuros. Se llama a `initTheme()` antes de montar la
 * app para que no parpadee.
 */
export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'sunat.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

// El almacenamiento puede no existir o lanzar (navegación privada): no es grave.
function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function store(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Sin almacenamiento la elección dura hasta recargar.
  }
}

const media = typeof matchMedia === 'function' ? matchMedia(DARK_QUERY) : null
const systemDark = ref(media?.matches ?? false)
const preference = ref<ThemePreference>(readStored())
const resolved = computed<'light' | 'dark'>(() =>
  preference.value === 'system' ? (systemDark.value ? 'dark' : 'light') : preference.value,
)

function apply(): void {
  document.documentElement.dataset.theme = resolved.value
}

let listening = false

export function initTheme(): void {
  apply()
  if (media && !listening) {
    listening = true
    media.addEventListener('change', () => {
      systemDark.value = media.matches
      apply()
    })
  }
}

export function useTheme() {
  function setPreference(value: ThemePreference): void {
    preference.value = value
    store(value)
    apply()
  }

  return { preference: readonly(preference), resolved, setPreference }
}
