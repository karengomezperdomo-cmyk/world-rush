# 05 · WORLD MINI APP CHECKLIST (semilla de la Fase 0)

> **Regla:** ninguna fila pasa a `IMPLEMENTED` sin **evidencia** (test automatizado, captura o comprobación en dispositivo real).
> Estados: `IMPLEMENTED` · `NOT IMPLEMENTED` · `NEEDS MY INPUT` · `NOT APPLICABLE`.
> **Estado actual: 0 filas `IMPLEMENTED`** (no existe código de producto). Esta tabla se completa y se re-verifica en la **Fase 12**
> contra la documentación vigente *de ese día* (World la cambia con frecuencia).
> Fuentes y marcas (✅ doc · 🔎 código · 🧪 por verificar) en [`01-world-docs-review.md`](01-world-docs-review.md).

## 1 · Inicialización y MiniKit

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 1.1 | MiniKit **2.x** (`@worldcoin/minikit-js ^2`), sin patrones 1.x (`commands`/`commandsAsync`) | ✅ Migration | NOT IMPLEMENTED | `pnpm ls` + lint que prohíbe `commandsAsync` | 2 |
| 1.2 | Inicializar con `MiniKitProvider` (o `MiniKit.install()`) y **comprobar `success`** | ✅ Init | NOT IMPLEMENTED | test de arranque + dispositivo | 2 |
| 1.3 | Comandos de arranque en el **mismo efecto** que `install()` (evita la condición de carrera) | ✅ FAQ | NOT IMPLEMENTED | revisión de código + prueba en dispositivo | 2 |
| 1.4 | Distinguir World App / navegador con `MiniKit.isInstalled()` | ✅ Init | NOT IMPLEMENTED | Playwright (mock) + dispositivo | 2 |
| 1.5 | Detectar capacidades con `window.WorldApp.supported_commands` (p. ej. haptics) | ✅ Init | NOT IMPLEMENTED | test unitario del detector | 2/5 |
| 1.6 | Manejo de errores por `try/catch` (los comandos **lanzan**) y códigos (`user_rejected`…) | ✅ Responses | NOT IMPLEMENTED | tests de errores | 2/3 |
| 1.7 | **Integración MiniKit/IDKit real y funcional** durante la revisión | ✅ Review policy | NOT IMPLEMENTED | prueba E2E en dispositivo | 12 |

## 2 · World ID

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 2.1 | `@worldcoin/idkit ^4.x` (no `idkit-standalone`, no `MiniKit.verify`) | ✅ IDKit · SKILL | NOT IMPLEMENTED | `pnpm ls` + lint | 2/3 |
| 2.2 | RP registrado; `RP_SIGNING_KEY` **solo en servidor**, jamás `NEXT_PUBLIC_*` ni en logs | ✅ Integrate | NEEDS MY INPUT (D1) | escaneo de secretos en CI + revisión | 3 |
| 2.3 | Firma RP generada **en el backend** por petición | ✅ Integrate | NOT IMPLEMENTED | test de endpoint | 3 |
| 2.4 | Prueba reenviada **tal cual** a `POST /api/v4/verify/{rp_id}`; comprobar `success`, `environment`, `action` | ✅ Integrate · Verify API | NOT IMPLEMENTED | tests con respuestas simuladas + Simulator | 3 |
| 2.5 | **Nullifier** guardado como `NUMERIC(78,0)` con `UNIQUE(action, nullifier)`; duplicado rechazado (el Portal acepta reutilización) | ✅ Integrate · 🔎 SKILL | NOT IMPLEMENTED *(SQL diseñado y validado en PGlite; no en producto)* | test de integración | 3/4 |
| 2.6 | `signal` ligado al usuario y **comprobado** en el servidor | ✅ Credentials | NOT IMPLEMENTED (🧪 método exacto) | test + código de `idkit-core` | 2/3 |
| 2.7 | `allow_legacy_proofs` decidido con criterio (y doble nullifier 3.0/4.0 aclarado con World) | ✅ · ❓ | NEEDS MY INPUT (preguntar a World) | respuesta de World | 3 |
| 2.8 | Entornos coincidentes: `environment` del widget = acción = simulador/teléfono real | ✅ SKILL | NOT IMPLEMENTED | prueba con Simulator **y** teléfono | 3/13 |
| 2.9 | Insignia oficial **human** (icono + «human», sin remezclar texto) a la derecha del username en leaderboards | ✅ IDKit Design | NOT IMPLEMENTED | revisión visual | 9 |
| 2.10 | **No** usar World ID como sustituto del login | ✅ Wallet Auth | NOT IMPLEMENTED (por diseño) | revisión de flujos | 3 |
| 2.11 | Procedimiento documentado de **rotación** de la clave de firma | 🔎 Portal MCP | NOT IMPLEMENTED | runbook | 10 |
| 2.12 | Estados de UI de IDKit: cancelado, error, sin conexión (sin cargas infinitas) | ✅ IDKit Design · Review | NOT IMPLEMENTED | tests + dispositivo | 3/9 |

## 3 · Autenticación

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 3.1 | `MiniKit.walletAuth` con **nonce del backend**: alfanumérico, ≥ 8, **sin guiones**, de un solo uso | ✅ Wallet Auth · Migration | NOT IMPLEMENTED | tests (nonce reutilizado/expirado) | 3 |
| 3.2 | **Verificar siempre en backend** con `verifySiweMessage` (+ comprobación propia de `domain`/`uri`/`chainId`) | ✅ · 🔎 código | NOT IMPLEMENTED | tests + dispositivo (🧪 `domain` real) | 3 |
| 3.3 | Sesiones propias: token opaco, hash en BD, revocables, CSRF | diseño | NOT IMPLEMENTED | tests + revisión de seguridad | 3/10 |
| 3.4 | Mostrar **username, no la dirección** de wallet | ✅ App Guidelines | NOT IMPLEMENTED | revisión visual + test de la API (sin `wallet_address` en respuestas) | 3/9 |
| 3.5 | Detectar cambio de cuenta de World App (`walletAddress` ≠ sesión) | diseño | NOT IMPLEMENTED | dispositivo | 3 |
| 3.6 | Cookies de sesión funcionan en la WebView de **Android** y **iOS** | ✅ WebView spec (🧪) | NOT IMPLEMENTED | dispositivos reales | 3 |

## 4 · Wallet, pagos y transacciones

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 4.1 | **No** solicitar permisos de gasto ni ejecutar transacciones sin autorización expresa | Brief §19/34 | NOT IMPLEMENTED *(regla del proyecto; se hará cumplir con una comprobación en CI que prohíba `pay`/`sendTransaction`/`signMessage`)* | grep en CI | 1+ |
| 4.2 | `Pay` / verificación de pagos en backend | ✅ Pay | NOT APPLICABLE (sin pagos en v1) | — | — |
| 4.3 | `sendTransaction`, lista blanca de contratos/tokens, Permit2 | ✅ Send Transaction | NOT APPLICABLE | — | — |
| 4.4 | Guías de contratos inteligentes (custodia inmutable, tests ≥ 90 %, código compartido con World) | ✅ Smart contract guidelines | NOT APPLICABLE (sin contratos) | reabrir si hay recompensas | — |
| 4.5 | Sin preventas de tokens, sin membresías que aumenten rendimiento | ✅ App Guidelines | NOT APPLICABLE | — | — |

## 5 · WebView y UX móvil

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 5.1 | Aspecto de **app móvil**: navegación por pestañas inferiores, sin *footers*/barras laterales/hamburguesa, CTAs visibles, sin scroll excesivo | ✅ App Guidelines | NOT IMPLEMENTED (el mock tiene un pie a retirar: C2) | revisión visual | 9 |
| 5.2 | **Safe areas** (`safeAreaInsets` + `env()`); tab bar a 12 px de la barra del sistema; padding 24 px; botones a 24 px del teclado | ✅ Design Guidelines | NOT IMPLEMENTED | dispositivos | 9 |
| 5.3 | Sin elementos interactivos junto a los controles superiores derechos de la Mini App | ✅ Design Guidelines | NOT IMPLEMENTED | dispositivos | 5/9 |
| 5.4 | `overscroll-behavior: none` y `100dvh` (sin *scroll bounce* en iOS) | ✅ App Guidelines | NOT IMPLEMENTED | iPhone | 9 |
| 5.5 | Sin ventanas nuevas, sin `alert()`, sin depender del zoom | ✅ WebView spec | NOT IMPLEMENTED | lint (`no-alert`) + dispositivo | 2+ |
| 5.6 | Carga inicial **2–3 s**, acciones posteriores **< 1 s** | ✅ App Guidelines | NOT IMPLEMENTED | medición en gama baja (presupuestos `02-…` §14) | 9 |
| 5.7 | Funciona con **mala conexión**, se recupera de desconexiones, **sin cargas infinitas** | ✅ Review policy | NOT IMPLEMENTED | pruebas con red limitada/cortes | 9/11 |
| 5.8 | El **progreso se sincroniza** entre plataformas (todo vive en el servidor) | ✅ Review policy | NOT IMPLEMENTED | prueba iOS ↔ Android | 11 |
| 5.9 | Sin funciones que existan solo en una plataforma (haptics con degradación silenciosa) | ✅ Review policy | NOT IMPLEMENTED | dispositivos | 5 |
| 5.10 | Estados de **carga, error y vacío** centrados y consistentes | ✅ Design Guidelines | NOT IMPLEMENTED | revisión visual | 9 |
| 5.11 | Localización (EN, ES…) con `Accept-Language` | ✅ App Guidelines | NEEDS MY INPUT (A6) | revisión | 9 |
| 5.12 | Pausa automática al pasar a segundo plano | diseño | NOT IMPLEMENTED | dispositivo | 5 |

## 6 · Ficha de la app (metadatos)

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 6.1 | **Nombre sin «World»**, corto, sin emojis/marcas ajenas | ✅ Review policy | **NEEDS MY INPUT (A1)** ⚠️ conflicto C1 | revisión | 2/12 |
| 6.2 | `short_name`, `category`, **eslogan** (`world_app_description`), `description_overview` (1–2 frases, < 25 palabras) | 🔎 Portal MCP · ✅ policy | NEEDS MY INPUT | Portal | 12 |
| 6.3 | **Icono** cuadrado, fondo no blanco, PNG/JPEG ≤ 500 KB | ✅ App Guidelines · 🔎 | NOT IMPLEMENTED (C1) | Portal | 12 |
| 6.4 | **Content card** 345×240 px (PNG a 3×), sin texto, 94 px inferiores libres | ✅ App Guidelines | NOT IMPLEMENTED (C1) | Portal | 12 |
| 6.5 | ≥ 1 **captura** (showcase) en inglés | 🔎 Portal MCP | NOT IMPLEMENTED | Portal | 12 |
| 6.6 | `app_website_url` (producción) | 🔎 Portal MCP | NEEDS MY INPUT (H1) | Portal | 12 |
| 6.7 | **Países** (≥ 1) e **idiomas** (debe incluir `en`) | 🔎 Portal MCP | NEEDS MY INPUT | Portal | 12 |
| 6.8 | `is_android_only`, `is_for_humans_only` | 🔎 Portal MCP | NEEDS MY INPUT | Portal | 12 |
| 6.9 | `support_link` (https o `mailto:`) | 🔎 Portal MCP | NEEDS MY INPUT | Portal | 12 |
| 6.10 | Sin «official», sin logo de World ni versión modificada, sin aparentar respaldo oficial | ✅ Review policy · App Guidelines | NOT IMPLEMENTED (C1/C2/C7) | revisión de arte y textos | 9/12 |
| 6.11 | Premios (futuros) **por habilidad, nunca por azar** | ✅ App Guidelines | NOT APPLICABLE (sin premios en v1) | reabrir con recompensas | — |
| 6.12 | App **final** (no demo/beta), completa, sin secciones «próximamente» | ✅ Review policy | NEEDS MY INPUT (A7) | revisión | 9/12 |
| 6.13 | Camino de prueba para el **equipo de revisión** si el ranking exige Orb | ✅ Review policy | NEEDS MY INPUT | acordar con World | 12 |

## 7 · Soporte, privacidad y legal

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 7.1 | Email de soporte válido y datos de contacto actualizados | ✅ Review policy | NEEDS MY INPUT | Portal | 12 |
| 7.2 | **Consentimiento** antes de guardar datos y **minimización** | ✅ Review policy | NOT IMPLEMENTED (diseño: `03-…` §10) | revisión + test de la API | 3/10 |
| 7.3 | Política de privacidad / términos accesibles 🧪 (campos que solo estén en el dashboard) | ✅ · 🧪 | NEEDS MY INPUT | Portal | 12 |
| 7.4 | Cumplimiento regulatorio en los países elegidos (incluido concurso de habilidad si hubiera premios) | ✅ Review policy | NEEDS MY INPUT | asesoría legal (no la doy yo) | 12 |
| 7.5 | Analítica opcional solo si `optedIntoOptionalAnalytics` = true | ✅ Init | NOT IMPLEMENTED | test | 9 |
| 7.6 | Borrado/anonimización de cuenta bajo petición | diseño | NOT IMPLEMENTED | test | 10 |

## 8 · Permisos y notificaciones

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 8.1 | Notificaciones: permiso en Portal + permiso del usuario + API key; **solo funcionales**; tope diario | ✅ Notifications | NOT APPLICABLE (apagadas por decisión D3 hasta aprobación) | — | 14 (si se aprueba) |
| 8.2 | Contactos / micrófono | ✅ Request Permission | NOT APPLICABLE (no se solicitan) | — | — |
| 8.3 | Haptics (no requiere permiso) | ✅ Haptics | NOT IMPLEMENTED | dispositivo | 5 |
| 8.4 | `MiniKit.attestation` | ✅ Attestation | NOT APPLICABLE (❓ verificación en servidor sin documentar) | preguntar a World | — |

## 9 · Seguridad

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 9.1 | **Nunca** confiar en payloads del cliente; verificar SIWE/World ID/pagos en backend | ✅ FAQ | NOT IMPLEMENTED | tests + revisión | 3/10 |
| 9.2 | Ningún secreto en el frontend/repositorio; `.env*` ignorados; escaneo en CI | Brief §26 | NOT IMPLEMENTED | CI | 1+ |
| 9.3 | Panel admin separado, con auditoría inmutable | diseño | NOT IMPLEMENTED | tests | 9/10 |
| 9.4 | Rate limiting, límites de payload, CSP estricta | diseño | NOT IMPLEMENTED | pruebas de abuso | 10 |
| 9.5 | Aislamiento de entornos con guardas técnicas | `02-…` §12 | NOT IMPLEMENTED | tests de arranque | 1/13 |

## 10 · Pruebas y publicación

| # | Requisito | Fuente | Estado | Cómo se verificará | Fase |
|---|---|---|---|---|---|
| 10.1 | Probar en **iOS y Android reales** dentro de World App (`worldcoin.org/mini-app?app_id=…`) | ✅ Testing | NEEDS MY INPUT (D2) | dispositivos | 2+ |
| 10.2 | Probar World ID con **Simulator (staging)** y con **teléfono (producción)** | ✅ SKILL | NOT IMPLEMENTED | ambos | 3/13 |
| 10.3 | La app **se puede acceder para revisión** | ✅ Review policy | NEEDS MY INPUT | Portal | 12 |
| 10.4 | Enviar la **app de producción** (las de staging no se pueden enviar) desde el Developer Portal | 🔎 Portal MCP | NOT IMPLEMENTED | Portal | 12/14 |
| 10.5 | Conjunto completo de campos y de imágenes requerido por el Portal antes de enviar | 🔎 Portal MCP | NOT IMPLEMENTED | validación del Portal | 12 |
| 10.6 | Repasar la documentación vigente **el día del envío** (World cambia con frecuencia) | Brief §32 | NOT IMPLEMENTED | este mismo checklist re-verificado | 12 |

## Resumen (recuento real, calculado con un script sobre esta tabla)

| Estado | Filas |
|---|---|
| `IMPLEMENTED` | **0** |
| `NOT IMPLEMENTED` | 52 |
| `NEEDS MY INPUT` | 16 |
| `NOT APPLICABLE` | 8 |
| **Total** | **76** |

Los `NEEDS MY INPUT` se resuelven con las decisiones de [`04-…`](04-decisions-and-questions.md) (nombre, idiomas, países, hosting, soporte, cuenta del Portal…).
Los `NOT APPLICABLE` se reabren si se aprueban recompensas, notificaciones o transacciones.
