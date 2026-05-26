# Stem Player

Aplicacion web local para importar, guardar y reproducir proyectos de stems de audio. Permite crear proyectos desde archivos MP3, WAV o M4A, mezclar pistas por separado y mantener los datos en el navegador.

## Funcionalidades

- Crear proyectos con uno o varios archivos de audio.
- Guardar proyectos y archivos localmente en IndexedDB mediante Dexie.
- Listar, renombrar y eliminar proyectos guardados.
- Reproducir stems sincronizados con Web Audio.
- Controlar transporte: reproducir, pausar, detener, reiniciar y buscar posicion.
- Ajustar volumen master y volumen por pista.
- Usar mute, solo y presets de volumen por stem.
- Reordenar pistas con drag and drop y persistir el nuevo orden.
- Mantener la pantalla activa durante la reproduccion cuando el navegador soporta Wake Lock.
- Mostrar avisos cuando un proyecto tiene pistas sin audio local disponible.

## Stack

- Angular 20
- Angular CDK Drag Drop
- Dexie / IndexedDB
- Web Audio API
- Lucide Angular
- Karma + Jasmine para tests unitarios

## Requisitos

- Node.js compatible con Angular 20.
- Un navegador moderno con soporte para Web Audio e IndexedDB.

La importacion mide la duracion real de cada archivo con Web Audio. Los datos se guardan en el almacenamiento local del navegador, asi que borrar los datos del sitio puede eliminar los audios importados.

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm start
```

Abre `http://localhost:4200/`. La aplicacion recarga automaticamente al cambiar archivos fuente.

## Build

```bash
npm run build
```

El build de produccion queda en `dist/`.

## Tests

```bash
npm test
```

Ejecuta los tests unitarios configurados con Karma y Jasmine.

## Uso Basico

1. Entra a `Proyectos`.
2. Escribe un nombre para el proyecto.
3. Selecciona uno o mas stems en formato MP3, WAV o M4A.
4. Crea el proyecto y abrelo desde la lista.
5. Usa el reproductor para mezclar, silenciar, poner pistas en solo, reordenar stems y controlar la reproduccion.

## Estructura Principal

- `src/app/features/projects`: pantalla y servicios para importar, listar, renombrar y eliminar proyectos.
- `src/app/features/player`: reproductor, mezclador y estado de playback.
- `src/app/core/services`: motor de audio y Wake Lock.
- `src/app/core/storage`: base Dexie, filas IndexedDB y mapeadores.
- `src/app/core/models`: modelos de dominio para proyectos, stems y estado del reproductor.
- `src/app/shared`: iconos, pipes, estilos compartidos y utilidades de UI.
