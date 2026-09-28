import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

// `vite.config.ts` exporta una función para poder leer las variables de entorno,
// así que aquí se resuelve a un objeto antes de mezclarlo.
const resolvedViteConfig = viteConfig({ mode: 'test', command: 'serve' })

export default mergeConfig(
  resolvedViteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
