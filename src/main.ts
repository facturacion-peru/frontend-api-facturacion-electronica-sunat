// Inter autoalojada (spec 010, A-50): sin peticiones a terceros, también en el APK.
import '@fontsource-variable/inter'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { initDevice } from './core/device'
import { initTokenStorage } from './core/api/token-storage'
import { initTheme } from './shared/composables/useTheme'
import router from './app/router'
import { installBackButton } from './app/back-button'

// Tema antes de montar: sin parpadeo de claro a oscuro (spec 010, HU-5).
initTheme()

// Web o app Android, y la sesión guardada, antes de que el router la consulte (spec 013).
await initDevice()
await initTokenStorage()

const app = createApp(App)

app.use(createPinia())
app.use(router)
installBackButton(router)

app.mount('#app')
