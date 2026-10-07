# Frontend — Facturación Electrónica SUNAT

Cliente web para la [API de Facturación Electrónica SUNAT Perú](https://github.com/facturacion-peru/Api-de-facturacion-electronica-sunat-Peru), construido con Vue 3 y TypeScript.

Esta es la aplicación de **todos los usuarios de una empresa**, incluido su administrador: ventas, tickets, comprobantes, productos, inventario, usuarios, series y configuración SUNAT de la propia empresa. También aloja el panel del administrador de la plataforma, en un área separada (`/plataforma`, spec 006, A-35). Ver [`docs/aclaraciones.md`](https://github.com/facturacion-peru/sdd-docs/blob/main/docs/aclaraciones.md#a-08), A-08.

Está pensada para empaquetarse también como APK con Capacitor, compartiendo el mismo código que la versión web.

## Repositorios del proyecto

| Repositorio | Qué contiene |
|---|---|
| [sdd-docs](https://github.com/facturacion-peru/sdd-docs) | Documentación: visión, constitución, specs y aclaraciones. Explica cómo clonar los tres juntos |
| [Api-de-facturacion-electronica-sunat-Peru](https://github.com/facturacion-peru/Api-de-facturacion-electronica-sunat-Peru) | API REST (Laravel), emisión SUNAT, despliegue y operación |
| [frontend-api-facturacion-electronica-sunat](https://github.com/facturacion-peru/frontend-api-facturacion-electronica-sunat) | Aplicación web (Vue) de las empresas y de la plataforma |

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
4. Ante un `401`, el middleware descarta el token local; `token-storage` avisa (`onTokenCleared`) y la sesión de Pinia se vacía sin que el cliente HTTP conozca los stores.
5. El guard global (`core/auth/guards.ts`) recupera la sesión al recargar (`GET /auth/me`) y, si no hay sesión, lleva a `/login?redirect=<ruta>`. Tras entrar, vuelve a esa ruta (solo rutas internas: `safeRedirect`).

No hay cookies, ni CSRF, ni dominios *stateful*: el mismo código sirve para web y para el APK.

El token caduca a las 24 h (`SANCTUM_EXPIRATION` en la API); el re-login devuelve al usuario a la pantalla en la que estaba.

Las rutas declaran `meta.requiresAuth`, `meta.guestOnly`, `meta.public` y `meta.roles` (`company_admin`, `seller`). El guard es solo experiencia de usuario: la autorización real la aplica siempre la API. El administrador de la plataforma no usa esta aplicación y ve un aviso propio.

`token-storage.ts` está aislado en su propio módulo: en la web usa `localStorage`; en la app Android, el almacén seguro del dispositivo (Keystore) a través de `core/device`, con una copia en memoria que `initTokenStorage()` carga al arrancar. El cliente HTTP y los stores no saben cuál se usa.

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
│   ├── auth/               # Sesión (Pinia), guards del router y tipos de sesión
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

Features actuales (specs 001 a 007):

| Feature | Pantallas |
|---|---|
| `auth` | Login, recuperar contraseña, restablecer y aceptar invitación |
| `company` | Mi empresa: datos legales de solo lectura, contacto y logo |
| `users` | Usuarios e invitaciones: invitar, reenviar, cancelar, cambiar rol, desactivar |
| `audit` | Auditoría con filtros |
| `sales` | Venta rápida que emite ticket, boleta o factura (vista previa con la regla de redondeo del servidor, clave de idempotencia en reintentos, selector de cliente con alta rápida y de serie); ticket de 80 mm imprimible, anulación y listado con totales; «Ventas» con pestañas Tickets y Comprobantes; detalle del comprobante con el resultado de SUNAT, descargas (PDF A4/80 mm, XML, CDR) y «Reintentar»; devoluciones y anulaciones con nota de crédito, notas y saldo por línea, y descarte de rechazados (administrador); clientes para el administrador |
| `sunat` | Configuración SUNAT (credenciales SOL sin mostrar nunca la clave, certificado con historial, «Validar»), series con su correlativo, e indicador «Emisión SUNAT» en el Inicio con aviso de certificado por vencer |
| `platform` | Panel del administrador de la plataforma en `/plataforma`, con su propio layout: empresas (estado SUNAT, filtros, alta, ficha, corrección de datos legales, suspensión con motivo, reenvío de invitación), soporte de la emisión y auditoría. Solo metadatos (A-37). Se carga en diferido; al empaquetar el APK se puede excluir |
| `inventory` | Catálogo de productos, formulario, ficha con lotes e historial (ajustes y reversiones), entrada rápida de mercadería y alertas de stock bajo y vencimiento |
| `data-transfer` | «Importar y exportar» (`/datos`, administrador, spec 014): exportación de ventas por rango de fechas de Lima, catálogo y clientes completos, y asistente de importación (plantilla, «Solo crear» o «Crear y actualizar», vista previa con errores por fila y cambios campo por campo, confirmación). En Android, las descargas abren «Compartir» y el archivo se elige con el selector del teléfono |

Piezas compartidas:

- `shared/ui`: botón, campo, `FormField`, alerta, diálogo accesible, badge, estado vacío, `EnvironmentBadge` («PRUEBAS — sin valor legal», siempre visible en beta) y `ExportButton` (diálogo «Exportar» de una lista; recibe la descarga como prop).
- `shared/composables/useApiForm`: envío y errores 422 por campo.
- `core/api/download`: descarga de archivos de la API con el token (un enlace directo no lleva `Authorization`).
- `shared/utils/format`: soles, cantidades sin ceros sobrantes y fechas en español del Perú. Solo formatean: los importes y las cantidades llegan de la API como cadenas decimales exactas y nunca se calculan en el frontend.
- Navegación (`app/layouts/MainNav.vue`): Inicio, Vender, Ventas y Productos; la gestión del administrador (incluidas Clientes, SUNAT y Series) va en «Más». Un enlace se marca activo por prefijo de ruta, para que «Ventas» siga marcada en comprobantes y detalles.
- Impresión: `main.css` tiene una regla `@media print` que imprime solo `.print-area` en papel de 80 mm.
- `shared/testing/mountWithRouter`: solo para pruebas; `beforeMount` permite fijar la sesión antes de montar.

Las respuestas de la API se tipan a mano en el `types.ts` de cada feature, porque el OpenAPI aún no documenta respuestas. Cada tipo indica el `JsonResource` de Laravel que refleja; su forma la protegen las pruebas de contrato de la API.

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
| `pnpm android:dev` | App Android de desarrollo en el teléfono conectado (API de la PC por la red local) |
| `pnpm android:release` | APK firmado para empresas (API con HTTPS) |

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_APP_NAME` | Sí | Nombre visible de la aplicación |
| `VITE_API_BASE_URL` | No | Base de la API. Vacía en desarrollo (se usa el proxy) |
| `VITE_API_PROXY_TARGET` | No | Destino del proxy de desarrollo. Por defecto `http://127.0.0.1:8000` |

`env.ts` valida al arrancar las que son obligatorias, para fallar al inicio y no a mitad de una petición.

## App Android (spec 013)

La app Android es esta misma aplicación empaquetada con **Capacitor 8** (`android/`). La interfaz va dentro del APK y habla con la API por HTTPS. Todo lo que depende del teléfono pasa por `src/core/device/`, que tiene una implementación web y otra nativa:

- **Sesión:** se guarda en Keystore.
- **Archivos:** los PDF, XML y CDR se entregan con «Compartir» de Android. Así se imprime el ticket, usando el PDF de 80 mm de la API.
- **Botón «Atrás»:** cierra el diálogo abierto, vuelve a la pantalla anterior o manda la app al fondo.
- **Versión instalada:** se envía en `X-App-Version`. Si la API responde `426`, se muestra «Actualiza la app».

### Requisitos

- **JDK 21.** Capacitor 8 no compila con el 17.
- **Android SDK con la plataforma 36.**

En esta máquina están en `~/Android`. Antes de compilar, exportar en la terminal (o en `~/.bashrc`):

```bash
export JAVA_HOME=~/Android/jdk-21.0.12.1+1
export ANDROID_HOME=~/Android/sdk
```

`android/local.properties` (no versionado) apunta al SDK: `sdk.dir=/home/<usuario>/Android/sdk`.

### Desarrollo en un teléfono (red local)

1. Levantar la API para la red local: `PHP_CLI_SERVER_WORKERS=4 php artisan serve --host=0.0.0.0 --port=8000`.
   - Con un solo proceso, las llamadas simultáneas de la app esperan unos segundos.
   - Su `.env` debe incluir `https://localhost` en `CORS_ALLOWED_ORIGINS`, porque ese es el origen de la app.
2. Crear `.env.android-dev.local` (no versionado) con la IP de la PC: `VITE_API_BASE_URL=http://192.168.x.y:8000`.
3. Conectar el teléfono por USB (con la depuración USB activa) o por Wi-Fi (abajo) y ejecutar `pnpm android:dev`. Compila, sincroniza e instala la variante *debug*.

#### Por Wi-Fi (depuración inalámbrica, Android 11 o superior)

El teléfono y la PC deben estar en la **misma red Wi-Fi**. `adb` está en `~/Android/sdk/platform-tools`; conviene agregarlo al `PATH`: `export PATH=~/Android/sdk/platform-tools:$PATH`.

1. **Vincular**, solo la primera vez:
   - En el teléfono, ir a *Opciones de desarrollador → Depuración inalámbrica → Vincular dispositivo con código de vinculación*. Muestra una IP, un puerto y un código de 6 dígitos.
   - En la PC, ejecutar `adb pair 192.168.1.50:37123` con la IP y el puerto de **ese diálogo**, y escribir el código.
2. **Conectar:**
   - En la pantalla principal de *Depuración inalámbrica* aparece «Dirección IP y puerto». Es **otro puerto**, distinto del de vincular.
   - En la PC, ejecutar `adb connect 192.168.1.50:41234` con esa IP y ese puerto.
   - `adb devices` debe listar el teléfono como `device`.
3. **Instalar y abrir:** ejecutar `pnpm android:dev`, como con USB.
4. **Depurar:**
   - En Chrome de la PC, abrir `chrome://inspect/#devices`. Ahí aparece el WebView de la app (solo la variante *debug*) con su consola, red y elementos.
   - El registro nativo se ve con `adb logcat | grep -iE "Capacitor|chromium"`.

Cosas a saber:

- **El puerto cambia.** Cada vez que se apaga la depuración inalámbrica o se reinicia el teléfono, cambia el puerto de conexión. Hay que repetir `adb connect` con el nuevo; la vinculación se conserva.
- **El teléfono debe llegar a la API.** Desde el navegador del teléfono, abrir `http://<IP de la PC>:8000/up` debe responder. Si no responde, la API está escuchando solo en `127.0.0.1` (falta `--host=0.0.0.0`), un firewall bloquea el puerto (`sudo ufw allow 8000/tcp`) o la red Wi-Fi aísla a los clientes (pasa en redes de invitados).
- **Xiaomi, Redmi y Poco (MIUI/HyperOS):** sin un permiso extra, la instalación falla con `INSTALL_FAILED_USER_RESTRICTED`. Hay que activar en *Opciones de desarrollador* «Instalar vía USB» (MIUI pide iniciar sesión con la cuenta Mi y a veces tener SIM) y «Depuración USB (ajustes de seguridad)». Además, hay que aceptar en el teléfono el aviso que aparece en cada instalación. Aunque la conexión sea por Wi-Fi, el permiso se llama igual.
- **La IP de la PC puede cambiar** con el router. Si la app no conecta, revisar `hostname -I` y actualizar `.env.android-dev.local`.

En el emulador de Android, la PC es `10.0.2.2`: `VITE_API_BASE_URL=http://10.0.2.2:8000 pnpm android:dev`. La variante *debug* también se puede inspeccionar con `chrome://inspect`.

Solo la variante *debug* acepta HTTP. La versión para empresas exige HTTPS: no tiene `usesCleartextTraffic` ni permite contenido mixto.

### Versión para empresas

```bash
pnpm android:release   # APK firmado en android/app/build/outputs/apk/release/
```

- `.env.android` debe tener la URL **https** de la API (spec 009); sin ella, la compilación falla.
- La versión sale de `version` en `package.json`. Subirla en cada entrega: `versionCode` se calcula como x·10000 + y·100 + z, y Android no instala encima una versión menor.
- En la API, `APP_ANDROID_MIN_VERSION` obliga a actualizar las versiones viejas.

### Firma (clave de la app)

- El APK se firma con la clave `~/Android/keys/facturacion-sunat-release.jks`.
- Gradle la lee de `android/keystore.properties`, que contiene la ruta, el alias y la contraseña. Ese archivo está en `.gitignore` y **nunca va al repositorio**.
- Hay una copia en `respaldos/android-firma/` y otra debe guardarse fuera de esta máquina.
- **Si se pierde la clave o su contraseña, la app instalada ya no se puede actualizar**: habría que desinstalarla y empezar con otro identificador.

### Provisional

El nombre («Facturación SUNAT») y el identificador (`io.github.facturacion_peru.app`) son provisionales (A-61). Se fijan antes de la primera entrega a una empresa. Para cambiarlos hay que modificar `capacitor.config.ts` y `android/app/build.gradle` y regenerar la plataforma.

La impresión Bluetooth directa (ESC/POS) queda para una spec propia. El dato que decide el enfoque es si las térmicas usan **Bluetooth Classic (SPP)** o **BLE**.

## Nota sobre versiones

TypeScript está fijado en `~5.9` en lugar del 6.0 que instala `create-vue` por defecto. El motivo es que `openapi-typescript@7.13.0` declara `typescript: ^5.x` como peer dependency y ninguna versión publicada soporta todavía la 6.

Es un downgrade deliberado y sin efectos colaterales: toda la tooling de Vue del proyecto (`vue-tsc`, `@vue/tsconfig`, `@vue/eslint-config-typescript`) acepta TypeScript `>=5.8`. La alternativa era instalar con `--legacy-peer-deps` y quedarse con un árbol de dependencias inconsistente.

Conviene revisarlo cuando `openapi-typescript` publique soporte para TypeScript 6.
