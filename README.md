# Stem Player

Aplicación web local para importar, guardar y reproducir proyectos de stems de audio. Permite crear proyectos desde archivos MP3, WAV o M4A, mezclar cada pista por separado y conservar los datos en el navegador.

## Funcionalidades

- Crear proyectos con uno o varios archivos de audio.
- Agregar o quitar stems en proyectos existentes, manteniendo al menos una pista con audio.
- Guardar proyectos y archivos localmente en IndexedDB mediante Dexie.
- Listar, renombrar y eliminar proyectos guardados.
- Reproducir stems sincronizados mediante Web Audio.
- Decodificar audio en un Web Worker, con fallback al hilo principal si el navegador no lo permite.
- Guardar PCM decodificado en IndexedDB y mantener hasta dos proyectos en caché de memoria durante la sesión.
- Activar Modo en vivo: deshabilita el seek y exige que todas las pistas con archivo estén cargadas.
- Recuperar el audio cuando el navegador suspende el `AudioContext`.
- Controlar reproducción, pausa, detención, reinicio y posición.
- Aplicar un fundido corto al mover la posición durante la reproducción para reducir cortes audibles.
- Ajustar volumen master, volumen por pista y paneo discreto L / L-R / R.
- Usar mute y solo por stem.
- Guardar automáticamente los ajustes de mezcla en el proyecto.
- Reordenar pistas con drag and drop y persistir el nuevo orden.
- Usar barra de desplazamiento horizontal para mezclas con muchas pistas.
- Mantener la pantalla activa durante la reproducción cuando el navegador soporta Wake Lock.
- Mostrar avisos cuando un proyecto tiene pistas sin audio local disponible.
- Incluir metadatos de instalación mediante `manifest.webmanifest`.

## Stack

- Angular 20
- Componentes standalone y detección de cambios zoneless
- Angular CDK Drag Drop
- Dexie / IndexedDB
- Web Audio API
- Web Workers
- Lucide Angular
- Karma + Jasmine para tests unitarios

## Requisitos

- Node.js compatible con Angular 20
- Un navegador moderno con soporte para Web Audio, Web Workers e IndexedDB

La compatibilidad real de MP3, WAV y M4A depende de los códecs que implemente el navegador. En particular, no todos los navegadores pueden decodificar todas las variantes de M4A.

## Persistencia local

Los proyectos, archivos originales y datos PCM se guardan en la base IndexedDB `stem-player`. No existe backend, cuenta de usuario ni sincronización en la nube.

Los datos pertenecen al navegador, dispositivo y origen web donde se importaron. Por ejemplo, los proyectos creados en `http://localhost:4200` no aparecen automáticamente en el dominio desplegado en Cloudflare. Borrar los datos del sitio, usar navegación privada o cambiar de navegador puede hacer que dejen de estar disponibles.

La caché PCM de IndexedDB se valida con el hash del archivo. Además, los `AudioBuffer` de hasta dos proyectos se conservan temporalmente en memoria para acelerar el regreso a proyectos abiertos durante la misma pestaña. Esta caché se invalida al agregar o quitar pistas.

La preferencia de Modo en vivo se guarda en `sessionStorage`: se mantiene durante la pestaña actual, pero no es una configuración permanente del proyecto.

El manifest aporta nombre, colores y modo standalone para instalación cuando el navegador lo admita. Actualmente no hay service worker, por lo que la aplicación no garantiza inicio o recarga sin conexión.

## Instalación

```bash
npm install
```

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

## Uso básico

1. Entra a `Proyectos`.
2. Escribe un nombre para el proyecto.
3. Selecciona uno o más stems en formato MP3, WAV o M4A.
4. Crea el proyecto y ábrelo desde la lista.
5. Usa el reproductor para mezclar, panear, silenciar, poner pistas en solo, reordenar stems y controlar la reproducción.
6. Activa `Modo en vivo` cuando necesites bloquear el seek y exigir que todas las pistas estén listas antes de reproducir.
7. Vuelve a `Proyectos` si necesitas agregar o quitar stems del proyecto.

## Estructura principal

- `src/app/features/projects`: creación, importación, edición y eliminación de proyectos y pistas.
- `src/app/features/player`: reproductor, mezclador y estado de reproducción.
- `src/app/core/services`: motor de audio, decodificación, caché de sesión y Wake Lock.
- `src/app/core/audio`: worker de decodificación y conversión PCM / AudioBuffer.
- `src/app/core/storage`: base Dexie, filas IndexedDB, caché PCM y mapeadores.
- `src/app/core/models`: modelos de dominio para proyectos, stems y estado del reproductor.
- `src/app/shared`: iconos, pipes, estilos compartidos y utilidades de UI.

Las rutas `/projects` y `/player/:projectId` cargan sus páginas de forma diferida.
