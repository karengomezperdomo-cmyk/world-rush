# 04 · Decisiones, preguntas y permisos

> Para no hacerte 50 preguntas pequeñas: son **30 decisiones agrupadas A–H**, cada una con mi **recomendación** y una
> **prioridad**. **Solo 5 son bloqueantes ahora (🔴: A2, B6, D1, D2, E1)**; el resto tienen valor por defecto.
> Puedes contestar así: *«todo por defecto excepto A1 = RUSH 7, A2 = (b), B1 = (b)»*.
>
> 🔴 **bloquea la Fase 1 o la 2** · 🟡 necesaria antes de una fase concreta (indicada) · ⚪ puede esperar
>
> **Actualización 2026-09-20:** respondidas **A1 (RUSH 7), B1 (esquema A), C1 (arte provisional), D1 (las apps del Portal las creas tú),
> E1 (stack aprobado), F1 (Postgres en Vercel), G1 (lo financia el equipo) y H1 (Vercel, la cuenta ya existe)**. El estado vigente,
> las consecuencias y lo que sigue pendiente (A2, B3, B5, B6, D2, A3, A5, plan de Vercel, GitHub) están en
> [`../DECISIONS.md`](../DECISIONS.md). Las tablas de abajo son la propuesta original.

## A. Producto

| ID | Pregunta | Opciones | Recomendación | Prio |
|---|---|---|---|---|
| **A1** | **Nombre público.** Las guías de World prohíben «World» en el nombre (y «official», y aparentar afiliación) → «WORLD RUSH» no pasaría revisión. | Nombres que no lo usan (**sin búsqueda de marcas hecha**; hay que comprobar tiendas y registros): **RUSH 7** (7 días, 7 mapas) · DAILY RUSH · HUMAN RUSH · RUSH WEEK · SEVENTH GEAR · propón el tuyo | **RUSH 7**; «WORLD RUSH» queda solo como *codename* interno. Decidir **antes de producir arte** (el wordmark del mock lo lleva) | 🟡 antes de Fase 2 (crear la app en el Portal) y del arte |
| **A2** | **¿Quién puede aparecer en el leaderboard?** | (a) solo humanos verificados con World ID (Orb) · (b) cualquiera con wallet; los verificados llevan la insignia *human* · (c) todos juegan y rankean; la verificación solo será necesaria para premios futuros | **(a)** para que «REAL PLAYERS» sea cierto (World mismo lo recomienda para leaderboards); el resto juega en modo práctica y ve «verifica para entrar al ranking». Coste: menos audiencia (no todos son Orb) | 🔴 condiciona Fases 3 y 7 |
| **A3** | **Hora oficial de cambio de día** y **fecha de inicio de la Semana 1** | UTC 00:00 · otra hora fija (dime cuál) | **UTC 00:00**, lunes. Cualquier hora fija le cae mal a alguien (00:00 UTC = 19:00 en Colombia, ~07:00 en Tailandia); la UI muestra la hora local. (En tu mock la semana 15–21 sep no coincide con el calendario de 2026: es ilustrativa.) | 🟡 antes de Fase 8 |
| **A4** | **Regla de cierre** | corte estricto · un run *iniciado antes* del cierre puede terminar hasta **N s** después | **120 s de gracia** (solo para runs ya iniciados; nadie puede empezar uno nuevo) | ⚪ por defecto |
| **A5** | **Fórmula del «1 CHAMPION» semanal** (no la fijo hasta que elijas) | (1) suma de posiciones en los 7 mapas, con penalización por día no jugado · (2) puntos por posición (tipo F1 o por percentil), días no jugados = 0 · (3) suma de tiempos + penalización fija por día no jugado · (4) mejores X de 7 · (5) solo compiten quienes completan los 7 | *Sin recomendación.* Consideraciones: (1)/(2) no dependen de la duración de cada mapa; (3) sí; (2) y (4) perdonan faltar; (5) premia la constancia pero excluye a muchos; **debe ser 100 % por habilidad (sin azar)** para World | ⚪ antes de mostrar «campeón» |
| **A6** | **Idiomas de lanzamiento** | EN · ES · PT · TH · JA · KO | **EN + ES**, con i18n desde el día 1 (World recomienda además PT/TH/JA/KO) | ⚪ por defecto |
| **A7** | **Pestaña REWARDS «COMING SOON»** | mantenerla · ocultarla tras un *flag* | **Ocultarla** hasta que sea real: la revisión exige app *final, no demo/beta* | 🟡 antes de Fase 9 |
| **A8** | **Abrir fuera de World App** (navegador) | bloquear · aterrizaje + leaderboard público de solo lectura | **Aterrizaje con enlace/QR + leaderboard de solo lectura**; sin juego clasificatorio | ⚪ por defecto |

## B. Gameplay y motor

| ID | Pregunta | Opciones | Recomendación | Prio |
|---|---|---|---|---|
| **B1** | **Esquema de controles** (detalle en `02-…` §6) | A: 4 botones digitales · B: mitades de pantalla + inclinación analógica · C: auto-gas + 2 botones | **A** (fiel al género, inputs binarios ⇒ replays pequeños y validación limpia, máxima justicia). C solo como modo casual *no clasificatorio* | 🟡 antes de Fase 5 |
| **B2** | **Composición en vertical** | canvas a pantalla completa con zoom-out y *look-ahead* · ventana casi cuadrada arriba + controles abajo | **Prototiparé ambas** en la Fase 5 y decidimos con la jugabilidad real | ⚪ por defecto |
| **B3** | **Al chocar** | *respawn* en el último checkpoint con el cronómetro corriendo · el run falla y se reinicia · *respawn* con penalización fija | **Respawn en checkpoint, cronómetro corriendo** (estilo del género) | 🟡 antes de Fase 5 |
| **B4** | **Duración objetivo por mapa** | — | **45–90 s** (sesiones cortas; replays de ~600 B) | ⚪ por defecto |
| **B5** | **Motor de render** | PixiJS 8 · Phaser 4 · Canvas propio | **PixiJS 8** (ver medidas en `02-…` §5). Phaser si prefieres herramientas hechas a cambio de ~2× de peso | 🟡 antes de Fase 5 |
| **B6** | **Física determinista** y **spike de 2–3 días** antes del primer mapa | Box2D v3 WASM → Rapier determinista → física propia | **Aprobar el spike** con criterios medibles (`02-…` §5.4). Necesita iPhone **y** Android reales (D2) | 🔴 aprobar el enfoque ahora |

## C. Visual

| ID | Pregunta | Opciones | Recomendación | Prio |
|---|---|---|---|---|
| **C1** | **Arte y audio definitivos: ¿quién los produce y con qué licencia?** | los aportas tú · los generas tú con IA · trabajo con arte provisional (programático/CC0) hasta que llegue el definitivo | **Arte provisional** para no bloquear el desarrollo. Ojo: verifica la **propiedad/licencia** de imágenes generadas con IA y de cualquier sonido antes de publicar | 🟡 antes de Fase 6 |
| **C2** | **Ajustes de marca sobre tu mock** (por las guías de World) | quitar «BUILT FOR WORLD» y el globo del logo · sustituir el chip «Verified with World ID» por la **insignia oficial *human*** junto al nombre · evitar «official» y elementos tipo *footer* | **Sí, aplicarlos.** El resto del mock (Home, fichas, pestañas, paleta) lo sigo tal cual | ⚪ por defecto |
| **C3** | **Nombres y biomas de los mapas 2–7** (el mock sugiere playa, bosque, industrial, volcán, nieve, espacio) | los defines tú · propongo yo | **Nombres provisionales** míos hasta que decidas | ⚪ por defecto |

## D. World / MiniKit

| ID | Pregunta | Opciones | Recomendación | Prio |
|---|---|---|---|---|
| **D1** | **Cuenta y equipo del Developer Portal** y quién crea las apps | (i) las creas tú en el dashboard con mi checklist · (ii) tú creas una API key de equipo y **conectas el MCP del Portal en tu propia configuración** (yo no veo la clave; cada acción sensible como *enviar a revisión* pediría tu confirmación) · (iii) solo guías | **(i)** al principio; (ii) si quieres automatizar. **Nunca me pegues claves en el chat** | 🔴 antes de Fase 2 |
| **D2** | **Dispositivos de prueba** | iPhone · Android · ambos, con World App instalada | **Ambos** (el determinismo y las cookies se prueban en iOS y Android; MiniKit **solo** funciona dentro de World App) | 🔴 antes de Fase 2 |
| **D3** | **Confirmar que notificaciones, pagos y permisos de wallet quedan APAGADOS** hasta nueva aprobación tuya | sí | **Sí.** No configuro nada de eso en el Portal | ⚪ confirmación |

## E. Backend

| ID | Pregunta | Opciones | Recomendación | Prio |
|---|---|---|---|---|
| **E1** | **¿Apruebas el stack de `02-…` §3?** (TypeScript · pnpm/corepack · Next.js · Drizzle · PostgreSQL · sesiones propias · admin separado) | sí · cambios | **Sí** | 🔴 desbloquea la Fase 1 |
| **E2** | **Alcance y accesos del panel admin** | subir **paquetes de nivel compilados** (v1) · **editor visual de niveles** dentro del panel (mucho más trabajo) — y ¿quiénes serán admins y cómo entrarán (Google, email…)? | **Paquetes compilados en la v1**; el editor visual, después. Los accesos se deciden en la Fase 9 | ⚪ (accesos: 🟡 Fase 9) |
| **E3** | **Idioma del código, comentarios y documentación técnica** | inglés · español | **Inglés** (lo usan los paquetes y la doc de World); tú y yo hablamos en español | ⚪ por defecto |

## F. Base de datos

| ID | Pregunta | Opciones | Recomendación | Prio |
|---|---|---|---|---|
| **F1** | **Proveedor de Postgres para staging/producción** | Neon · Supabase · otro · decidir más tarde | **Decidir más tarde.** Hasta staging desarrollo con Postgres local/embebido, **sin cuentas** (los teléfonos se conectan por túnel a tu PC) | ⚪ hasta Fase 13 |
| **F2** | **Retención de datos** | — | Replay completo **30 días** (salvo top-100 y sospechosos: indefinido) · analítica **180 días** y luego agregada · nonces/sesiones caducadas purgadas a diario | ⚪ por defecto |
| **F3** | **Desempate a igual tiempo** | gana el más antiguo · empate compartido | **Gana quien lo logró antes** (orden total y determinista) | ⚪ por defecto |

## G. Rewards

| ID | Pregunta | Opciones | Recomendación | Prio |
|---|---|---|---|---|
| **G1** | **¿Quién financiaría los premios y con qué formato?** (solo para diseñar bien la custodia; **no implemento nada**) | tú · patrocinadores · cuotas de entrada · sin ideas todavía | **Sin urgencia.** Solo se reserva la arquitectura; nada de economía ni permisos de gasto | ⚪ |

## H. Despliegue

| ID | Pregunta | Opciones | Recomendación | Prio |
|---|---|---|---|---|
| **H1** | **Hosting, dominio y presupuesto mensual máximo** | Vercel Pro · contenedor Node (Fly/Railway/Render) · Cloudflare | **Vercel Pro** por rapidez (**el plan Hobby es solo no comercial**); mantengo la app portable a Node. Dime tope de gasto y si tienes dominio | 🟡 antes de Fase 13 (para probar: túnel) |
| **H2** | **Repositorio** | `git init` local · además repo **privado** en GitHub (ya tengo `gh`) | `git init` local ya en la Fase 1; **te pido permiso** antes de crear nada en tu cuenta de GitHub | 🟡 Fase 1–2 |
| **H3** | **Tres entornos** (local / staging / producción) con apps de Portal, BD y secretos separados | sí | **Sí** (`02-…` §12) | ⚪ confirmación |

## Decisiones que tomo yo (seguras, reversibles y estándar — objeta lo que no te guste)

- TypeScript estricto; ESLint/Prettier; commits pequeños; **pnpm mediante `corepack`** (sin instalación global).
- BD: `text + CHECK` en vez de ENUM; UUID como PK; tiempos en **ms enteros**; **nada** de floats para tiempos.
- Reloj de la BD como fuente de verdad; estado de competición derivado del reloj; jobs idempotentes.
- Sin librerías de analítica de terceros; sin *fingerprinting*; sin IP en claro.
- Sesiones opacas con hash en BD; CSRF; CSP estricta; consultas parametrizadas.
- Física detrás de una interfaz (`PhysicsWorld`) para poder cambiar de motor sin tocar el resto.
- `feature flags` apagados por defecto (`RANKED_ENABLED`, `REWARDS_ENABLED`, `NOTIFICATIONS_ENABLED`).
- Arte y audio provisionales, claramente marcados, hasta que exista el definitivo (C1).
- Ningún secreto en el frontend; `.env*` ignorados por git; `.env.example` sin valores reales.

## Servicios, cuentas, claves y permisos

**No conectaré, crearé ni pagaré nada de esto sin tu permiso explícito.** Ninguna acción externa se ha realizado hasta ahora
(solo lectura de documentación pública y paquetes de npm en una carpeta temporal).

| Necesidad | Para qué | ¿Cuenta / clave? | ¿Coste? | Cuándo | Quién actúa |
|---|---|---|---|---|---|
| **World Developer Portal** (equipo + Mini App + RP de World ID + acciones) | Probar en World App, World ID, ficha y revisión | Cuenta de equipo + **API key** (secreta) si usas el MCP | Sin verificar (consultar) | Fase 2 | **Tú** (o el MCP con tu clave, con tu confirmación) |
| **Dispositivos con World App** | MiniKit solo funciona ahí | — | — | Fase 2 | Tú |
| **Túnel público** (ngrok/zrok/tunnelmole) | Abrir tu servidor local en el móvil | Posible cuenta gratuita | Gratis/planes | Fase 2 | Tú aceptas; yo lo lanzo |
| **GitHub** (repo privado + Actions) | Repositorio y CI | Tu cuenta | Gratis/planes | Fase 1–2 | Tú autorizas |
| **Postgres alojado** (Neon/Supabase/…) | Staging y producción | Cuenta + `DATABASE_URL` (secreto) | De pago en producción | Fase 13 | Tú |
| **Hosting** (Vercel Pro u otro) | Servir la app | Cuenta | **De pago** | Fase 13 (antes, si quieres URL estable) | Tú |
| **Dominio** | `app_website_url`, cookies, CSP | Registrador | De pago | Fase 12–13 | Tú |
| **Cloudflare** (WAF/rate limit) y **R2** (storage) | Límite por IP; niveles/imágenes | Cuenta | Gratis/planes | Fases 10–13 | Tú |
| **Proveedor RPC de World Chain** | `verifySiweMessage` fiable en producción | Cuenta + API key | Gratis/planes | Fase 13 | Tú |
| **Sentry** (opcional) | Errores en WebViews | Cuenta | Gratis/planes | Fase 10+ | Tú |
| **Proveedor de identidad del admin** | Acceso al panel | OAuth (Google, etc.) | Gratis | Fase 9 | Tú |
| **Email de soporte** y **política de privacidad/términos** | Requisito de la ficha y la revisión | Buzón + URL pública | — | Fase 12 | Tú |

**Secretos previstos (jamás en el frontend ni en el repo):** `RP_SIGNING_KEY` · API key del Developer Portal · `DATABASE_URL` ·
claves HMAC/sesión · clave del RPC · credenciales OAuth del admin · claves de storage. Cada entorno tiene **los suyos**.
Si alguna se filtra: protocolo de rotación documentado (la de World ID invalida la anterior; requiere confirmación).

## Preguntas para World (las redacto yo; **las envías tú**)

Del §10 de `01-…`: (#3) `allow_legacy_proofs` y doble nullifier 3.0/4.0 · (#4) semántica de `expires_at_min` · (#5) verificación en servidor del token de
`attestation` · (#12) campos de la ficha no visibles vía MCP · viabilidad de una pestaña «próximamente». Canales oficiales: `developers@toolsforhumanity.com`
y el canal de Telegram de soporte para desarrolladores citados en la documentación. **No envío ningún mensaje en tu nombre sin que lo pidas.**

## Registro de decisiones

| ID | Decisión | Estado | Fecha |
|---|---|---|---|
| A1 · B1 · C1 · D1 · E1 · F1 · G1 · H1 | ver [`../DECISIONS.md`](../DECISIONS.md) §1 | **DECIDIDAS** | 2026-09-20 |
| A2 · A3 · A5 · B3 · B5 · B6 · D2 · H1a (plan Vercel) · H2 | ver [`../DECISIONS.md`](../DECISIONS.md) §5 | **PENDIENTES** | — |
| resto (A4 A6 A7 A8 B2 B4 C2 C3 D3 E2 E3 F2 F3 H3) | valor por defecto aplicado | **POR DEFECTO** | 2026-09-20 |
