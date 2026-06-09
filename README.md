# Stem Player

Aplicación web local para importar, guardar y reproducir packs de pistas de audio. Permite crear packs desde archivos MP3, WAV o M4A, mezclar cada pista por separado y conservar los datos en el navegador.

## Estado del proyecto

La aplicación funciona completamente en el cliente: no requiere backend, autenticación ni variables de entorno. Está orientada a ensayos y presentaciones donde se necesita reproducir y mezclar varios stems sincronizados desde un navegador moderno.

## Funcionalidades

- Crear packs con uno o varios archivos de audio.
- Agregar o quitar pistas en packs existentes, manteniendo al menos una pista con audio.
- Guardar packs y archivos localmente en IndexedDB mediante Dexie.
- Listar, renombrar y eliminar packs guardados.
- Crear setlists ordenados con packs del repertorio, precargarlos y abrirlos en el reproductor.
- Reproducir stems sincronizados mediante Web Audio.
- Decodificar audio en un Web Worker, con fallback al hilo principal si el navegador no lo permite.
- Guardar PCM decodificado en IndexedDB y mantener packs recientes en caché de memoria (LRU según RAM del dispositivo) durante la sesión.
- Activar Modo en vivo: deshabilita el seek y exige que todas las pistas con archivo estén cargadas.
- Recuperar el audio cuando el navegador suspende el `AudioContext`.
- Controlar reproducción, pausa, detención, reinicio y posición.
- Aplicar un fundido corto al mover la posición durante la reproducción para reducir cortes audibles.
- Ajustar volumen master, volumen por pista y paneo discreto L / L-R / R.
- Usar mute y solo por stem.
- Guardar automáticamente los ajustes de mezcla en el pack.
- Reordenar pistas con drag and drop y persistir el nuevo orden.
- Usar barra de desplazamiento horizontal para mezclas con muchas pistas.
- Mantener la pantalla activa durante la reproducción cuando el navegador soporta Wake Lock.
- Mostrar avisos cuando un pack tiene pistas sin audio local disponible.
- Incluir metadatos de instalación mediante `manifest.webmanifest`.

## Stack

- Angular 20.3
- Componentes standalone y detección de cambios zoneless
- Angular CDK Drag Drop
- Dexie / IndexedDB
- Web Audio API
- Web Workers
- Lucide Angular
- Karma + Jasmine para tests unitarios

## Requisitos

- Node.js 20.19 o una versión compatible con Angular 20
- npm 10 o posterior
- Un navegador moderno con soporte para Web Audio, Web Workers e IndexedDB

El proyecto se ha verificado con Node.js 20.19.4, npm 10.8.2 y Angular 20.3.19. Las versiones exactas de las dependencias instaladas están fijadas en `package-lock.json`.

La compatibilidad real de MP3, WAV y M4A depende de los códecs que implemente el navegador. En particular, no todos los navegadores pueden decodificar todas las variantes de M4A.

## Persistencia local

Los packs, archivos originales y datos PCM se guardan en la base IndexedDB `stem-player`. No existe backend, cuenta de usuario ni sincronización en la nube.

La base utiliza tres tablas:

- `projects`: metadatos del pack, orden de pistas y ajustes de mezcla.
- `trackAssets`: archivos de audio originales importados por el usuario.
- `decodedCaches`: audio PCM decodificado, asociado al hash del archivo original.

Los datos pertenecen al navegador, dispositivo y origen web donde se importaron. Por ejemplo, los packs creados en `http://localhost:4200` no aparecen automáticamente en el dominio desplegado en Cloudflare. Borrar los datos del sitio, usar navegación privada o cambiar de navegador puede hacer que dejen de estar disponibles.

La caché PCM de IndexedDB se valida con el hash del archivo. Además, los `AudioBuffer` de packs recientes se conservan temporalmente en memoria (evicción LRU según RAM del dispositivo) para acelerar el regreso a packs abiertos durante la misma pestaña. Esta caché se invalida al agregar o quitar pistas.

La preferencia de Modo en vivo se guarda en `sessionStorage`: se mantiene durante la pestaña actual, pero no es una configuración permanente del pack.

El manifest aporta nombre, colores y modo standalone para instalación cuando el navegador lo admita. Actualmente no hay service worker, por lo que la aplicación no garantiza inicio o recarga sin conexión.

## Instalación

Para una instalación reproducible a partir del lockfile:

```bash
npm ci
```

Usa `npm install` cuando necesites modificar dependencias y actualizar `package-lock.json`.

## Desarrollo

```bash
npm start
```

Abre `http://localhost:4200/`. La aplicación recarga automáticamente al cambiar archivos fuente.

Para compilar continuamente con la configuración de desarrollo:

```bash
npm run watch
```

## Build

```bash
npm run build
```

El build de producción queda en `dist/stem-player/browser`.

Los límites configurados para el build de producción son:

- Bundle inicial: aviso en 500 kB y error en 1 MB.
- Estilos por componente: aviso en 18 kB y error en 22 kB.

## Despliegue en Cloudflare Pages

Configuración:

- Framework preset: `Angular`
- Build command: `npm run build`
- Build output directory: `dist/stem-player/browser`
- Root directory: vacío, salvo que el repositorio se publique desde una subcarpeta
- Environment variables: ninguna requerida

El archivo `public/_redirects` incluye el fallback `/* /index.html 200` para que las rutas SPA, como `/player/:projectId`, funcionen al refrescar o abrir enlaces directos.

## Tests

```bash
npm test
```

Ejecuta los tests unitarios con Karma y Jasmine en modo interactivo. Para una sola ejecución:

```bash
npm test -- --watch=false
```

Antes de integrar cambios se recomienda ejecutar:

```bash
npm test -- --watch=false
npm run build
```

## Uso básico

1. Entra a **Packs** para importar stems y gestionar la biblioteca.
2. Entra a **Setlists** para armar el repertorio del show (orden, precarga e inicio).
3. En Packs, escribe un nombre, elige archivos MP3, WAV o M4A y pulsa **Crear**.
4. Abre un pack desde la lista o inicia un setlist con **Iniciar**.
5. Usa el reproductor para mezclar, panear, silenciar, poner pistas en solo, reordenar pistas y controlar la reproducción.
6. En un setlist, usa **Anterior** / **Siguiente** para cambiar de pack; el siguiente se precarga en segundo plano.
7. Activa `Modo en vivo` cuando necesites bloquear el seek y exigir que todas las pistas estén listas antes de reproducir.
8. Edita el orden de un setlist en `/setlists/:id`; vuelve a Packs para añadir o quitar pistas de un pack.

## Arquitectura

El flujo principal de la aplicación es:

1. `ProjectImportService` valida cada archivo, calcula su hash y solicita la decodificación.
2. `AudioDecodeService` intenta decodificar en `audio-decode.worker.ts`; si el entorno no lo permite, utiliza el hilo principal.
3. `ProjectStorageService` guarda el archivo original, el PCM decodificado y los metadatos mediante Dexie.
4. `PlayerPlaybackService` carga el pack, recupera la caché disponible y coordina el estado del reproductor.
5. `AudioEngineService` monta los `AudioBuffer`, sincroniza el transporte y aplica volumen, paneo, mute y solo.

Los componentes de página manejan la interacción y presentación. La lógica de importación, persistencia y reproducción permanece en servicios, mientras que los contratos de `src/app/core/contracts` mantienen desacopladas esas responsabilidades.

## Estructura principal

- `src/app/features/setlists`: persistencia, precarga en memoria y estado de setlists.
- `src/app/features/projects`: creación, importación, edición y eliminación de packs y pistas.
- `src/app/features/player`: reproductor, mezclador y estado de reproducción.
- `src/app/core/contracts`: interfaces para persistencia, reproducción y motor de audio.
- `src/app/core/services`: motor de audio, decodificación, caché de sesión y Wake Lock.
- `src/app/core/audio`: worker de decodificación y conversión PCM / AudioBuffer.
- `src/app/core/storage`: base Dexie, filas IndexedDB, caché PCM y mapeadores.
- `src/app/core/models`: modelos de dominio para packs, pistas y estado del reproductor.
- `src/app/core/utils`: importación, hashes, memoria de audio, tiempo y orden de pistas.
- `src/app/shared`: iconos, pipes, estilos compartidos y utilidades de UI.
- `public`: manifest, favicon y reglas de redirección para el despliegue SPA.

Las rutas `/packs`, `/setlists`, `/setlists/:setlistId` y `/player/:projectId` cargan sus páginas de forma diferida. `/projects` redirige a `/packs`. El reproductor acepta `?setlist=<id>&entry=<índice>` para navegar dentro de un setlist.

## Decisiones y limitaciones

- La duración del pack corresponde a la pista cargada de mayor duración.
- Los controles de volumen utilizan ganancia lineal entre 0 y 1.
- El paneo es discreto: izquierda, centro o derecha.
- Los cambios de mezcla se guardan con un debounce de 450 ms.
- El reproductor puede continuar con las pistas disponibles, salvo cuando está activo el Modo en vivo.
- No existe exportación de mezclas, copia de seguridad ni transferencia de packs entre navegadores.
- El manifest permite instalación en navegadores compatibles, pero la aplicación no es una PWA offline porque no registra un service worker.

## Solución de problemas

### El pack aparece, pero faltan audios

Los metadatos pueden existir aunque el almacenamiento del sitio se haya limpiado parcialmente. Vuelve a `Packs`, elimina las pistas afectadas y vuelve a importarlas.

### Un archivo M4A no se puede importar

El contenedor M4A admite distintos códecs y el soporte depende del navegador y del sistema operativo. Convierte el archivo a WAV o MP3, o prueba un navegador con soporte para ese códec.

### El audio se detiene al cambiar de aplicación o bloquear la pantalla

Algunos navegadores suspenden el `AudioContext` o no permiten Wake Lock. Regresa a la aplicación y usa la acción para reactivar el audio. Las políticas del sistema pueden seguir imponiendo restricciones.

### Los packs de desarrollo no aparecen en producción

IndexedDB está aislado por origen. `localhost`, un dominio de preview y el dominio de producción mantienen almacenes independientes.
