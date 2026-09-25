# RUSH 7 · Documento de diseño del juego (GDD) · v0

> **Estado:** primera pasada de diseño (fase de diseño previa al prototipo). Todo lo marcado **(propuesta)** se valida
> jugando en la Fase 5; nada de esto es una promesa de física final.
> **Provisionales:** nombre (RUSH 7), arte, nombres/temas de los mapas.
> **Pendientes de decisión:** A5 (campeón semanal), C (arte final). B2 (layout), B3 (choque) y A2 (ranking, ampliada) ya
> están decididos — ver `docs/DECISIONS.md` §1b.
> **Dónde verlo:** `design/index.html` (tablero) y `design/overview.png` (todas las pantallas en una imagen).

## 1. En una frase

Contrarreloj diaria de motos, vertical y pensada para el móvil: **cada día se abre un mapa distinto**, todos compiten por el
mejor tiempo, y al terminar el día ese ranking queda congelado. Siete mapas, siete días, un campeón semanal.

## 2. Bucle de juego

| Escala        | Qué pasa                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Carrera       | 45–90 s (B4): cuenta atrás → conducir → 3 checkpoints → meta → resultado → "TRY AGAIN".                     |
| Sesión        | 5–10 min: reintentar hasta bajar tu mejor tiempo, mirar el ranking, cerrar.                                 |
| Día           | A las 00:00 UTC se abre el mapa del día; al llegar el siguiente, el ranking de ayer queda congelado.        |
| Semana        | Siete mapas → pantalla "Week results". La regla del campeón semanal sigue abierta (A5); no se inventa.      |

## 3. Reglas que no cambian

- Un solo mapa abierto por día (UTC). Ventanas semiabiertas `[abre, cierra)`: un instante pertenece a un único día.
- Intentos ilimitados durante el día. **Solo cuenta el mejor tiempo válido.**
- Tiempos en milisegundos enteros, formato `MM:SS.mmm` (por ejemplo `00:34.821`). Nunca decimales en el sistema.
- **El servidor manda:** usa su propio reloj, vuelve a simular el replay y solo entonces da el tiempo por bueno. Lo que
  ve el jugador en pantalla al terminar es provisional hasta el estado "VERIFIED BY THE SERVER".
- Un humano, un puesto (World ID). Sin dinero ni premios en esta versión.
- Pausar no detiene el cierre del día: la carrera se pausa, el reloj diario no.

## 4. Controles (esquema A, decidido B1)

Cuatro botones digitales. En cada paso de simulación se guarda una máscara de 4 bits (`INPUT` en
`packages/game-core/src/inputs.ts`); esa secuencia comprimida es el replay que revisa el servidor.

| Botón        | Bit | Efecto                                                             |
| ------------ | --- | ------------------------------------------------------------------ |
| `GAS`        | 1   | Acelera.                                                           |
| `BRAKE`      | 2   | Frena; si la moto está parada, marcha atrás.                       |
| `LEAN BACK`  | 4   | Par hacia atrás: caballito y frenar el giro en el aire.            |
| `LEAN FWD`   | 8   | Par hacia delante: picar y aterrizar plano.                        |

Reglas de entrada **(propuesta)**:

- Multitoque: gas y una inclinación a la vez como mínimo; cada dedo controla el botón que tiene debajo y, si se desliza a
  otro, el estado cambia en el acto.
- Zona táctil mayor que el dibujo (8 px de margen invisible). Botones de 78 px o más.
- Sin gestos, sin sensores de movimiento y sin retardo entre pulsar y reaccionar.
- `touch-action: none` y sin selección de texto en el área de juego.
- Ajustes: intercambiar lados (zurdos) y elegir layout A o B.

## 5. Carrera paso a paso

1. **Cuenta atrás** 3-2-1 sobre el mundo; el reloj no corre.
2. **GO:** el reloj arranca (paso 0 del replay).
3. **Checkpoints:** 3, al 25 %, 50 % y 75 % del recorrido. Al cruzarlos aparece un chip con la diferencia frente a tu mejor
   tiempo (verde si mejoras, rojo si vas peor). Es la única comparación durante la carrera; no hay fantasma.
4. **Choque:** reaparece en el último checkpoint tras ~1,2 s y el reloj sigue corriendo (**B3, decidido**). El pad se
   atenúa durante la reaparición.
5. **Meta:** el tiempo sale solo de contar pasos de simulación con aritmética entera (regla exacta en la Fase 5).
6. **Envío:** el cliente manda el replay; el servidor lo vuelve a simular y responde con tiempo oficial y puesto.
7. **Resultado:** `FINISH!`, tiempo, mejor tiempo, puesto, parciales, "VERIFIED BY THE SERVER", `TRY AGAIN`.

Un **choque** (propuesta de reglas, ajustables): la cabeza o el torso tocan suelo o peligro, o la moto lleva más de 1,5 s
boca abajo casi parada.

Si la app pasa a segundo plano durante la carrera, se pausa sola. Si falla la conexión, la carrera se puede terminar; el
envío exige conexión (estado `NO CONNECTION`).

## 6. Cámara y pantalla vertical (B2, decidido)

El juego de referencia es horizontal; aquí sobra altura y falta anchura. Se construyen **los dos layouts**, con la misma
lógica (ver `design/index.html`, sección "Gameplay A vs B"):

| Layout                       | Mundo                            | Controles                                     | Idea                                          |
| ---------------------------- | -------------------------------- | --------------------------------------------- | --------------------------------------------- |
| **A · pantalla completa**    | 390 × 844                        | 4 botones flotantes de 78–90 px               | Más mundo. Terreno jugable entre 20 % y 65 %. |
| **B · ventana 4:3 + panel**  | 390 × 292                        | 4 pads altos (70–98 × 288 px) bajo la ventana | Los dedos nunca tapan el mundo.               |

Decidido: **A por defecto, B en Settings** (`docs/DECISIONS.md` §1b). El default final se confirma jugando en el
prototipo; riesgos a medir ahí:

- **Visibilidad:** en 390 px de ancho, la moto actual (80 × 60 px CSS) ocupa un 20 % del ancho y deja ver pocas
  longitudes de moto por delante. Probablemente haya que alejar la cámara (o reducir el sprite a ~32 px) y colocar la moto
  en el tercio izquierdo para tener mirada hacia delante.
- **Píxel entero:** 1 píxel de arte = 2 px CSS; el zoom de cámara solo toma valores enteros para no deformar el píxel-art.
- **Zonas seguras:** arriba 47 px, abajo 34 px, y la esquina superior derecha queda libre para los controles de la Mini
  App (regla de las guías de World revisadas en la Fase 0, `docs/phase-0/01-world-docs-review.md`).

## 7. HUD

Arriba a la izquierda: **pausa**, **tiempo** (`MM:SS.mmm`, dígitos de ancho fijo), **chip de parcial**, **3 casillas de
checkpoint** y una **barra de progreso** con meta a cuadros. Todo lo que comunica un estado usa color **y** signo (`−0.412`,
`+0.312`), nunca solo color.

## 8. Los siete mapas (propuesta; nombres y temas provisionales, C3)

| Día | Mapa           | Tema                    | Dificultad | Rasgo propio (propuesta)                           |
| --- | -------------- | ----------------------- | ---------- | -------------------------------------------------- |
| MON | Sunset Canyon  | Desierto al atardecer   | 1 de 5     | Rampas de madera, barrancos. Sirve de tutorial.    |
| TUE | Coral Coast    | Costa y playa           | 2 de 5     | Dunas suaves; el agua es peligro.                  |
| WED | Emerald Woods  | Bosque de pinos         | 2 de 5     | Troncos, raíces y saltos largos.                   |
| THU | Steel Yard     | Puerto industrial       | 3 de 5     | Plataformas y aterrizajes ajustados.               |
| FRI | Magma Ridge    | Volcán                  | 4 de 5     | Pendientes fuertes; la lava es peligro.            |
| SAT | Frost Peak     | Nieve y hielo           | 4 de 5     | Fricción baja y saltos enormes.                    |
| SUN | Orbit Circuit  | Espacio                 | 5 de 5     | Gravedad baja y largos giros en el aire.           |

**Cómo se construye un mapa** (propuesta): es una lista de segmentos (llano, rampa, hueco con salto, valle, baches, rampa de
aterrizaje) más parámetros del bioma (gravedad, fricción, paleta). Al compilar, un **verificador** ejecuta un replay de
referencia para probar que el mapa se puede completar, y una comprobación balística comprueba que ningún hueco supera el
80 % del salto máximo posible. Nada aleatorio: todos los jugadores corren exactamente el mismo mapa.

Boceto del mapa 1: llano inicial → subida de madera y salto sobre el barranco → CP1 → baches → valle (bajada y subida) →
CP2 → doble rampa con cactus → CP3 → rampa final y meta.

## 9. Sonido y vibración (plan)

- Efectos: motor (tono según la velocidad), aterrizaje, choque, checkpoint, meta, cuenta atrás y clics de interfaz.
- Música: un bucle corto por bioma, con interruptor propio. El audio arranca tras el primer toque (restricción de los
  navegadores y WebViews).
- Vibración: la Fase 0 documentó `MiniKit.sendHapticFeedback` y detectar soporte con `window.WorldApp.supported_commands`;
  si no existe se degrada en silencio, y se medirá la latencia en la Fase 5. Patrón previsto: ligera al aterrizar, fuerte al
  chocar, doble al terminar.

## 10. Arte

- **Escala:** 1 píxel de arte = 2 px CSS. Marcos con esquinas recortadas (truco de `box-shadow`).
- **Paleta:** muestreada de tu esquema (`design/tokens.css`).
- **Tipografía:** Jersey 15 (títulos y números; el 2 y el 5 se leen sin duda), Silkscreen (etiquetas), Chakra Petch
  (texto de interfaz). Todas con licencia OFL, en `design/fonts/licenses`.
- **Sprites actuales (provisionales):** moto 40 × 30 con 3 poses y rotación, piloto ragdoll 20 × 20 (4 cuadros),
  explosión 34 × 34 (6), polvo 14 × 10 (4), avatares 12 × 12 (8), miniaturas de mapa 46 × 28 (7), logo 100 × 36.
- **Generación:** `node tools/art/generate.mjs` produce siempre los mismos archivos. Sustituir un archivo por arte final del
  mismo tamaño no exige tocar pantallas.
- **Insignia "human":** hoy es un marcador. Las guías de World piden su insignia oficial junto al nombre en los
  rankings; se usará el recurso oficial sin retocarlo.

## 11. Accesibilidad y comodidad

Botones grandes, intercambio de lados, opción "Reduce flashing" (explosiones y sacudidas suaves), sin información solo por
color, texto de interfaz de 11 px o más, y todo el juego jugable con dos pulgares.

## 12. Rendimiento

Objetivo: 60 fps sostenidos en móviles de gama baja. Un único atlas de sprites, sin filtros ni post-proceso, partículas
limitadas y `image-rendering: pixelated`. El presupuesto exacto se fija con el prototipo de la Fase 5.

## 13. Riesgos de diseño

1. **Legibilidad vertical:** ver la pista con el ancho de un móvil (sección 6).
2. **Pulgares sobre el mundo (layout A):** por eso el terreno jugable vive en la franja alta.
3. **Física determinista frente a buen tacto:** el motor elegido en el spike de la Fase 5 manda sobre la sensación.
4. **Escala del arte:** el pixel-art actual es más grueso que el de tu esquema; el arte final lo puede afinar.
5. **Nombre:** hay un juego llamado "Seven Rush" en Google Play; se necesita una búsqueda formal de marca antes de
   publicar.

## 14. Decisiones y preguntas abiertas

Decidido el 2026-09-24 (`docs/DECISIONS.md` §1b): **B2** layout — se construyen A y B, A por defecto, B en Settings.
**B3** choque — reaparece en el último checkpoint, reloj vivo. **A2** ranking — solo verificados en el ranking; sin
verificar se puede jugar en modo práctica, sin ranking.

Sigue abierto:

| ID     | Pregunta                                    | Recomendación                  |
| ------ | -------------------------------------------- | ------------------------------- |
| **A5** | Fórmula del campeón semanal                 | Sin recomendación: decides tú.  |
| **C**  | ¿Arte final propio o provisional generado?  | Provisional hasta la Fase 8.    |
