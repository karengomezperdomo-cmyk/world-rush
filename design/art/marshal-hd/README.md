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
