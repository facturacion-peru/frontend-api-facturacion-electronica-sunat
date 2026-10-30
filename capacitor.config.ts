import type { CapacitorConfig } from '@capacitor/cli'

/**
 * App Android (spec 013). La interfaz va dentro del APK (`dist/`, A-67) y
 * habla con la API por HTTPS (A-62). Nombre e identificador PROVISIONALES
 * (A-61): se fijan antes de la primera entrega a una empresa.
 *
 * `CAP_ANDROID_DEV=1` (lo pone `pnpm android:dev`) permite llamar a la API de
 * la PC por HTTP en la red local. La versión para empresas se sincroniza sin
 * esa variable: sin contenido mixto (RF-007).
 *
 * En desarrollo la interfaz se sirve como `http://localhost` (spec 016): desde
 * `https://localhost`, Chromium bloquea las imágenes HTTP de la API (las fotos
 * de `IMAGES_DISK=public`) aunque `allowMixedContent` deje pasar fetch y XHR.
 * `localhost` sigue siendo un contexto seguro. Cambiar el esquema cambia el
 * origen: el localStorage del APK de desarrollo empieza vacío una vez (la
 * sesión está en Keystore y no se pierde).
 */
const dev = process.env.CAP_ANDROID_DEV === '1'

const config: CapacitorConfig = {
  appId: 'io.github.facturacion_peru.app',
  appName: 'Facturación SUNAT',
  webDir: 'dist',
  android: {
    allowMixedContent: dev,
  },
  ...(dev && { server: { androidScheme: 'http' } }),
}

export default config
