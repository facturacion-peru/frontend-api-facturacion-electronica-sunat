/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  /** 'true' en el piloto sin datos reales de clientes (spec 009, A-43). */
  readonly VITE_PILOT_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
