# Checkpoint girl (marshal HD): sprites

Animación del checkpoint: la chica del vestido rojo levanta los brazos y lanza corazones.
Es una versión en alta resolución del personaje que ya existe en `public/art/marshal/` (36×46 px).

## Archivos

| Animación | Frames | Loop | Uso |
|---|---|---|---|
| `idle-0..7.png` | 8 | sí | Esperando a que el jugador llegue (destellos alrededor) |
| `activate-0..13.png` | 14 | no | Se reproduce una vez al cruzar el checkpoint: baja los brazos, los sube, destello y empiezan los corazones |
| `loop-0..23.png` | 24 | sí | Después de activar: brazos arriba, los corazones siguen saliendo de las manos (bucle sin cortes) |

- Frame: **160 × 264 px**, PNG RGBA con fondo transparente.
- FPS sugerido: **12**.
- Pivote: centro de los pies, `(80, 263)`. Los pies tocan el borde inferior del frame.
- La parte de arriba del frame queda libre para que suban los corazones; el cuerpo ocupa unos 122×203 px en la parte de abajo.
- Flujo: `idle` (loop) → al pasar el jugador → `activate` (una vez) → `loop` (loop).

## Nota de escala

El resto del arte del juego es de baja resolución (marshal 36×46, bike 40×30). Estos frames son ~4.4× más grandes.
Para dibujarlos al mismo tamaño en pantalla que el marshal actual, hay que escalarlos ~0.23× (o ajustar a la altura deseada).
Escalar con suavizado (no nearest) al reducir, o usar `imageSmoothingEnabled = true` solo para este sprite.

## Qué se publica (2026-10-03)

Los PNG de arriba son los **masters** y se quedan en el repositorio. Lo que descarga el jugador son los
`.webp` que están a su lado, generados con `pnpm art:marshal`.

Esos 46 frames pesaban 1,77 MB en PNG: el **94% de todo el arte del juego** (el resto de `public/art` son
230 KB juntos) y, por sí solos, más que el presupuesto de 1,5 MB por mapa de `02-architecture-proposal.md`
§14. En WebP q95 son 433 KB, un 75% menos, con el canal alfa sin pérdida para que no aparezca halo.

Lo que **no** se hizo, y por qué: guardarla más pequeña. Se dibuja a ~0,63×, pero PixiJS renderiza a
`devicePixelRatio`, así que en un móvil 3× esos 264 px se pintan a ~503: ya se está **ampliando** casi 2×.
Reducir el original habría costado calidad justo en los móviles para los que es el juego.

El detalle de las medidas y las comparaciones está en `tools/art/encode-marshal.mjs`.
