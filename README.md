# Frontend — Facturación Electrónica SUNAT

Cliente web para la [API de Facturación Electrónica SUNAT Perú](../Api-de-facturacion-electronica-sunat-Peru), construido con Vue 3 y TypeScript.

Esta es la aplicación de **todos los usuarios de una empresa**, incluido su administrador: ventas, tickets, comprobantes, productos, inventario, usuarios, series y configuración SUNAT de la propia empresa. Solo el panel de la plataforma (gestión de todas las empresas del SaaS) vive aparte, en el proyecto Laravel. Ver [`docs/aclaraciones.md`](../docs/aclaraciones.md#a-08), A-08.

Está pensada para empaquetarse también como APK con Capacitor, compartiendo el mismo código que la versión web.

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | Vue 3 (`<script setup>`) | Composition API, SFC |
| Lenguaje | TypeScript 5.9 | Ver nota de versiones abajo |
| Build | Vite 8 | |
| Router | Vue Router 5 | |
| Estado | Pinia 4 | |
| Estilos | Tailwind CSS 4 | Mismo motor que usa el proyecto Laravel |
| Cliente HTTP | `openapi-fetch` | Tipado end-to-end contra el spec de la API |
| Utilidades | `@vueuse/core` | |
| Tests | Vitest + Vue Test Utils | |
| Calidad | ESLint + oxlint + Prettier | |

## Requisitos

- Node.js `^22.18.0 || >=24.12.0`
- La API de Laravel corriendo (por defecto en `http://127.0.0.1:8000`)

## Puesta en marcha

```bash
pnpm install
cp .env.example .env
pnpm dev
```

La aplicación queda en `http://localhost:5173`.

Necesitas la API levantada en paralelo:

```bash
cd ../Api-de-facturacion-electronica-sunat-Peru
php artisan serve --host=127.0.0.1 --port=8000
```

## Cómo se conecta con la API

En desarrollo, el front **no llama a la API por su dominio**. Hace peticiones a `/api/...` contra su propio origen (`localhost:5173`) y Vite las reenvía a Laravel mediante el proxy configurado en `vite.config.ts`.

Esto tiene dos ventajas: no dependes de la configuración de CORS para trabajar, y reproduces el escenario de despliegue en que front y API comparten dominio, donde el navegador tampoco ve dos orígenes distintos.

Si en producción los despliegas en dominios separados, define `VITE_API_BASE_URL` con la URL absoluta de la API **y** habilita ese origen en el CORS de Laravel. Ojo: ese proyecto todavía no publica `config/cors.php`, así que corre con el default del framework, que permite cualquier origen (`*`). Sirve para desarrollar, no para producción.

### Autenticación

La API emite *personal access tokens* de Sanctum. El flujo es:

1. `POST /api/auth/login` devuelve un `access_token`.
2. El token se guarda mediante `src/core/api/token-storage.ts`.
3. Un middleware de `openapi-fetch` lo adjunta como `Authorization: Bearer <token>` en cada petición saliente.
4. Ante un `401`, el middleware descarta el token local.

No hay cookies, ni CSRF, ni dominios *stateful*: el mismo código sirve para web y para el APK.

El token caduca a las 24 h (`SANCTUM_EXPIRATION` en la API), así que la interfaz debe contemplar el re-login.

`token-storage.ts` está aislado en su propio módulo a propósito: en web usa `localStorage`, pero al empaquetar con Capacitor conviene cambiarlo por el almacenamiento seguro del dispositivo, y esa sustitución no debería obligar a tocar el cliente HTTP ni los stores.

## Tipos generados desde la API

El proyecto Laravel genera un spec OpenAPI con `php artisan openapi:generate`. Desde ese archivo se derivan los tipos de TypeScript:

```bash
pnpm api:types
```

Esto reescribe `src/core/api/schema.d.ts` (unas 4 200 líneas, 78 endpoints). No edites ese archivo a mano.

El beneficio es que los errores contra la API se detectan al compilar, no en ejecución. Un campo mal escrito falla el build:

```
error TS2561: Object literal may only specify known properties,
but 'emial' does not exist in type '{ email: string; password: string; }'.
Did you mean to write 'email'?
```

Ejecuta `pnpm api:types` cada vez que cambien las rutas o las validaciones de la API.

**Limitación:** el spec documenta los *request bodies* (derivados de los `FormRequest` de Laravel) pero todavía no los *response bodies*. Por eso el sobre de respuesta se declara a mano en `src/core/api/types.ts`.

### Forma de las respuestas

La API responde siempre con la misma estructura para los listados:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "current_page": 1, "per_page": 20, "total": 25, "last_page": 2, "from": 1, "to": 20 }
}
```

`data` es siempre un array plano y `meta` describe únicamente la paginación. Los datos adicionales del listado (contadores, contexto de empresa) viajan en claves propias de primer nivel —`stats`, `company`— para que `meta` no signifique dos cosas distintas. Los tipos correspondientes están en `src/core/api/types.ts`.

## Arquitectura

Organización por **features**, no por tipo de archivo. Cada dominio agrupa sus vistas, componentes, stores y llamadas a la API, de modo que trabajar en facturación no obligue a saltar entre cinco carpetas lejanas.

```
src/
├── app/                    # Composición de la aplicación
│   ├── router/             # Router raíz; cada feature aporta sus rutas
│   ├── layouts/            # Estructuras de página compartidas
│   └── views/              # Vistas que no pertenecen a ningún dominio
├── core/                   # Infraestructura transversal
│   ├── api/
│   │   ├── client.ts       # Cliente tipado + middleware de auth
│   │   ├── schema.d.ts     # GENERADO — no editar
│   │   ├── types.ts        # Sobre de respuesta de la API
│   │   └── token-storage.ts
│   └── config/env.ts       # Acceso tipado a variables de entorno
├── features/               # Un directorio por dominio
│   └── <dominio>/
│       ├── api/            # Llamadas del dominio
│       ├── components/
│       ├── composables/
│       ├── stores/
│       ├── views/
│       └── routes.ts       # Rutas, montadas por el router raíz
└── shared/                 # Reutilizable entre features
    ├── ui/                 # Componentes de presentación sin lógica de dominio
    ├── composables/
    └── utils/
```

Reglas que sostienen la estructura:

- **Una feature no importa de otra feature.** Si dos necesitan lo mismo, ese código sube a `shared/` o a `core/`.
- **`core/` no conoce el dominio.** Es infraestructura: HTTP, configuración, almacenamiento.
- **`shared/ui` no habla con la API.** Recibe props y emite eventos.
- **Las rutas se declaran en cada feature** y se montan en el router raíz, para que agregar un módulo no haga crecer un archivo central sin control.

`features/` está vacío por ahora: los módulos se irán agregando uno a uno.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo con HMR |
| `pnpm build` | Chequeo de tipos + build de producción |
| `pnpm preview` | Sirve el build de producción |
| `pnpm type-check` | Solo chequeo de tipos |
| `pnpm lint` | oxlint + ESLint, con corrección automática |
| `pnpm format` | Prettier sobre `src/` |
| `pnpm test:unit` | Vitest en modo watch |
| `pnpm api:types` | Regenera los tipos desde el spec de la API |

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_APP_NAME` | Sí | Nombre visible de la aplicación |
| `VITE_API_BASE_URL` | No | Base de la API. Vacía en desarrollo (se usa el proxy) |
| `VITE_API_PROXY_TARGET` | No | Destino del proxy de desarrollo. Por defecto `http://127.0.0.1:8000` |

`env.ts` valida al arrancar las que son obligatorias, para fallar al inicio y no a mitad de una petición.

## Empaquetado como APK

Capacitor **todavía no está instalado**. Requiere Java y el Android SDK, que no están configurados en este entorno, y conviene añadirlo como un paso propio.

Cuando llegue el momento, el punto delicado será la impresión en térmicas Bluetooth. El dato que decide el enfoque es si las impresoras de destino usan **Bluetooth Classic (SPP)** —lo habitual en las térmicas económicas de 58 mm y 80 mm— o **BLE**, porque el plugin cambia en cada caso. Conviene además generar los comandos ESC/POS en el servidor y no en el cliente: la API ya produce el QR y las plantillas de 80 mm y 50 mm, y duplicar ese formato en JavaScript obligaría a mantenerlo sincronizado con las reglas de SUNAT en dos sitios.

## Nota sobre versiones

TypeScript está fijado en `~5.9` en lugar del 6.0 que instala `create-vue` por defecto. El motivo es que `openapi-typescript@7.13.0` declara `typescript: ^5.x` como peer dependency y ninguna versión publicada soporta todavía la 6.

Es un downgrade deliberado y sin efectos colaterales: toda la tooling de Vue del proyecto (`vue-tsc`, `@vue/tsconfig`, `@vue/eslint-config-typescript`) acepta TypeScript `>=5.8`. La alternativa era instalar con `--legacy-peer-deps` y quedarse con un árbol de dependencias inconsistente.

Conviene revisarlo cuando `openapi-typescript` publique soporte para TypeScript 6.
