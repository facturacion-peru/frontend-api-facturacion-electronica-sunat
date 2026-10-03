// Inter autoalojada (spec 010, A-50): sin peticiones a terceros, también en el APK.
import '@fontsource-variable/inter'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { initTheme } from './shared/composables/useTheme'
import router from './app/router'

// Tema antes de montar: sin parpadeo de claro a oscuro (spec 010, HU-5).
initTheme()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
