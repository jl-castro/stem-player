---
target: la UI del cuadernillo
total_score: 20
p0_count: 1
p1_count: 3
timestamp: 2026-10-17T19-41-28Z
slug: src-pages-index-astro
---
# Crítica: cuadernillo digital

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | La barra dice "1 de 88" al marcar, pero no es fija y desaparece al bajar. |
| 2 | Match System / Real World | 2 | El tono habla al estudiante; los ítems 82–88 piden A–D sin decir qué significan. El aviso nativo sale en inglés. |
| 3 | User Control and Freedom | 2 | Se puede cambiar una respuesta. Recargar borra todo. No hay salida de una página de miles de píxeles. |
| 4 | Consistency and Standards | 2 | Las escalas A y B usan la frase en el botón. El bloque de estudios y las situaciones no. Los kickers son 01, L, C, ¿, D, P, F. |
| 5 | Error Prevention | 2 | Nombre, fecha, radios y abiertas son obligatorios, y el cuarto tema se desmarca. Nada impide contestar 82–88 a ciegas. |
| 6 | Recognition Rather Than Recall | 2 | En la escala el significado está en el control. En 73–80 hay que leer seis frases de 11px y recordar la letra. |
| 7 | Flexibility and Efficiency | 1 | Un solo camino: scroll y tab, con cientos de paradas. No hay salto al primer ítem vacío. |
| 8 | Aesthetic and Minimalist Design | 3 | Cada tarjeta tiene número, enunciado y control. El ruido está en la portada y en la longitud, no dentro de la tarjeta. |
| 9 | Error Recovery | 2 | El foco salta al nombre y el navegador dice "Please fill out this field." El aviso en español queda en el pie. |
| 10 | Help and Documentation | 2 | Hay intro y leyenda de la escala. Se pierden al bajar. Junto a A–D no hay ayuda. |
| **Total** | | **20/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment:** La portada sí se lee como hecha por un modelo: papel punteado, ceja monoespaciada "CUADERNILLO DIGITAL · VERSIÓN 01", titular enorme con "te mueve" en itálica coral, medallón girado con el 88 y un ✦. No hay texto en degradado, ni glass, ni franja lateral. El cuestionario en sí es una rejilla repetida de tarjetas, apropiada para un formulario, pero no hay ritmo ni orientación dentro de esa repetición.

**Deterministic scan:** CLI, exit 2, dos avisos en `src/layouts/Layout.astro` línea 7: `overused-font` (Fraunces) y `layout-transition` (`transition: width`). En el navegador: 119 grupos, 170 instancias. `low-contrast` 115, `tiny-text` 49, `line-length` 3, `layout-transition` 2, `all-caps-body` 1. El detector y la lectura visual coinciden en el coral `#e97058` (2,8:1 sobre el papel, 3,0:1 en kickers y en el botón blanco sobre coral) y en las 48 frases de situación a 11px (`#657b78` sobre `#f3f6f1`, 4,1:1).

**Falsos positivos:** el segundo `layout-transition` sobre `body` es la misma regla atribuida otra vez; el cómputo real es `all` a 0s. `all-caps-body` en la ceja es una etiqueta de 11px, no un párrafo. Los 4,4:1 de `#657b78` sobre `#fffdf8` quedan 0,1 por debajo del corte: reales, pero marginales. Fraunces no es un falso positivo: solo aparece en el énfasis de la portada y encaja con el kit editorial.

**Overlays:** la inyección funcionó y marcó contraste y texto pequeño en la pestaña de la revisión.

## Overall Impression

El instrumento se siente cuidado hasta el ítem 72 y se rompe justo cuando las preguntas dejan de ser una escala. La mayor oportunidad es tratar cada alternativa como el botón, y dejar la portada en segundo plano.

## What's Working

- Las escalas muestran la frase, no el número. Al elegir, la pastilla pasa a tinta y el contador sube al momento.
- La voz de "Antes de comenzar" habla al estudiante: no hay respuestas correctas o incorrectas.
- El ítem de temas avisa "0 de 3 seleccionados" y no deja marcar un cuarto. La fecha llega rellena. Cada ítem tiene su número.

## Priority Issues

### [P0] Los ítems 82–88 solo muestran A B C D
- **Why it matters:** `education` en `questions.ts` guarda la letra como etiqueta, y `.letter-row .choice-label { display: none }` oculta el texto. Preguntas como "¿Qué duración de estudios te resulta aceptable?" no se pueden contestar.
- **Fix:** Poner la frase de cada opción dentro del botón, igual que la escala.
- **Suggested command:** /impeccable clarify

### [P1] Una sola página enorme y la barra se pierde
- **Why it matters:** En escritorio el cuadernillo mide unas 11.500 px; en 390 px, unas 31.000. "0 de 88 ítems respondidos" vive bajo la portada. Recargar borra el trabajo.
- **Fix:** Barra fija con el conteo y un enlace al primer ítem vacío. Guardar el borrador en el dispositivo.
- **Suggested command:** /impeccable layout

### [P1] En 73–80 la opción real está en 11px y el botón es una letra
- **Why it matters:** Seis frases en un recuadro gris y debajo A–F. En móvil cada letra mide unos 44×36 px, por debajo del mínimo táctil, a 5 px entre ellas.
- **Fix:** Cada alternativa es el botón. Se elimina la fila de letras.
- **Suggested command:** /impeccable clarify

### [P1] El error no está donde se mira
- **Why it matters:** Con el nombre vacío, el foco salta arriba y el navegador habla en inglés. "Completa los campos marcados antes de enviar." queda en el pie, a miles de píxeles, y el campo no se marca.
- **Fix:** Mensaje en español bajo el campo, `aria-invalid`, y scroll hasta ese campo.
- **Suggested command:** /impeccable harden

### [P2] La portada promete un cierre que el formulario desmiente
- **Why it matters:** El medallón, el ✦ y "Antes de ver mis resultados" venden un resultado. La propia intro dice que esta versión no muestra resultados. Los kickers (una L, un ¿) no orientan.
- **Fix:** Bajar la portada a un encabezado breve. Renombrar el cierre a algo como "Con tus palabras". Kickers estables.
- **Suggested command:** /impeccable quieter

## Persona Red Flags

**Jordan (primera vez):** En cinco segundos la acción visible es leer la portada, no responder el 01. El círculo "¿" parece un icono roto. En el 82, "Marca una sola opción por ítem" no dice cuál es la opción. Si falta el nombre, el siguiente aviso es un tooltip en inglés.

**Sam (teclado y contraste):** El `h1` queda "Conoce hacia dóndete mueve tu curiosidad" porque el `<br>` no inserta espacio. Hay cientos de paradas de tab. El nombre accesible de 82–88 es "A", "B", "C" o "D". Coral sobre crema en 2,7:1 y 3,0:1. El texto muted sobre el papel queda en 4,1:1. El botón principal, blanco sobre coral, en 3,0:1.

**Casey (móvil, a medias):** El envío solo existe al final, fuera del pulgar durante todo el ejercicio. No hay borrador si cambia de app. Las letras A–F no llegan a 44 px de alto. El titular se parte en cinco líneas junto al círculo de 88.

## Minor Observations

- La leyenda sigue hablando de 0, 1, 2 y 3 aunque el botón ya muestra la frase.
- En escritorio, A B C D del bloque de estudios se quedan a la izquierda, con vacío a la derecha, porque la fila está hecha para seis columnas.
- La fecha se ve como 10/17/2026 y en una captura el borde la cortaba.
- El contador de 88 no incluye las tres abiertas ni el nombre. Se puede llegar a 88 y seguir sin poder enviar.
- `transition: width` en la barra anima una propiedad de layout.

## Cognitive load

Fallan 6 de 8. Carga alta. Pasan agrupación y jerarquía dentro de la tarjeta. Fallan foco único, chunking (48 ítems seguidos), una cosa a la vez, opciones mínimas, memoria de trabajo y revelado progresivo.

Decisiones con más de 4 opciones: ítems 73–80 (6 alternativas), ítem 81 (13 temas), y en escritorio dos preguntas de 4 pastillas en el mismo vistazo.

## Emotional journey

La cima está en la primera frase y en el permiso de que no hay respuestas correctas. El valle es la repetición sin hitos. El suelo es el ítem 82, con cuatro letras vacías. El final, "Antes de ver mis resultados" seguido de "todavía no se muestran resultados", desmiente el pico de entrada.

## Questions to Consider

- ¿Y si cada alternativa fuera el botón, y la letra solo un código interno?
- ¿Hace falta una portada de landing para un cuadernillo que se responde una vez?
- ¿Qué pasaría si el estudiante pudiera salir y volver al primer ítem vacío, con las respuestas todavía ahí?
