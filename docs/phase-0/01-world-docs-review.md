# 01 · Revisión de la documentación oficial de World

**Fecha de la revisión:** 2026-09-19 · **Alcance:** Mini Apps, MiniKit, World ID (IDKit), Developer Portal, revisión/publicación.
**Regla del proyecto:** si algo del brief choca con la documentación vigente, se señala aquí y se pregunta; no se decide en silencio.

## 0. Cómo leer este documento

| Marca | Significa |
|---|---|
| ✅ | Confirmado en la **documentación oficial** (`docs.world.org`, páginas `.md` leídas el 2026-09-19) |
| 🔎 | Confirmado leyendo **código fuente/paquetes públicos** (`@worldcoin/minikit-js@2.0.3`, repo `worldcoin/developer-portal`) |
| 🧪 | **Por verificar empíricamente** (dispositivo real, cuenta del Developer Portal o un spike) |
| ❓ | **No documentado**: hay que preguntar a World |

Cómo se investigó: índice oficial [`llms.txt`](https://docs.world.org/llms.txt) → páginas en Markdown crudo (no resúmenes) →
registro de npm → código de los paquetes → servidor MCP público de la documentación. Detalle de fuentes en §11.

---

## 1. Versiones vigentes (npm, 2026-09-19)

| Paquete | Versión | Nota |
|---|---|---|
| `@worldcoin/minikit-js` | **2.0.3** | ✅ SDK oficial. **MiniKit 2.0 salió el 2026-03-31** (anuncio en el blog de World). |
| `@worldcoin/minikit-react` | 2.0.3 | hooks (p. ej. `useUserOperationReceipt`) |
| `@worldcoin/idkit` | **4.2.3** | ✅ World ID para React (widget). **Pinear `^4.x`**: los ejemplos 2.x/3.x ya no funcionan. |
| `@worldcoin/idkit-core` | 4.3.0 | JS puro + firma RP en backend (`/signing`) |
| `@worldcoin/create-mini-app` | 0.4.1 | plantilla **Next.js 15** (se clona con `degit`) |
| `@worldcoin/idkit-standalone` | 2.2.5 | ⚠️ **deprecado** (npm lo marca como paquete sin soporte) |
| Next.js (para referencia) | 16.3.5 | la plantilla oficial sigue en 15 → 🧪 comprobar compatibilidad en Fase 2 |

Dependencias *peer* de `minikit-js` 🔎: `react ^17‖^18‖^19`, `viem ^2.21`, `siwe ^3`, `wagmi ^3`.

## 2. Cambios importantes respecto a tutoriales antiguos (breaking changes de MiniKit 2.x) ✅

Fuente: [MiniKit 2.0 Migration](https://docs.world.org/mini-apps/migration/minikit-v2).

1. **La verificación World ID ya NO forma parte de MiniKit.** `MiniKit.verify` desaparece; se usa **`@worldcoin/idkit`**.
2. Los comandos son **métodos asíncronos de primer nivel**: `await MiniKit.walletAuth(...)` (antes `commands`/`commandsAsync`).
3. Toda respuesta es **`{ executedWith, data }`** con `executedWith ∈ "minikit" | "wagmi" | "fallback"`; los fallos se **lanzan** (usar `try/catch`).
4. Imports repartidos: `@worldcoin/minikit-js/commands`, `/siwe`, `/address-book`, `/minikit-provider`.
5. **`walletAuth`**: el nonce debe ser alfanumérico (≥ 8 caracteres) **sin guiones**: `crypto.randomUUID().replace(/-/g, "")`.
6. `signTypedData` está **deprecado**.
7. `sendTransaction`: recibe *calldata* ya codificado y devuelve `userOpHash`; **Permit2 pasa de SignatureTransfer a AllowanceTransfer**; `approve()` estándar vuelve a estar permitido.
8. **Inicialización:** en React, `MiniKitProvider` (`@worldcoin/minikit-js/minikit-provider`) instala MiniKit; sin React,
   `MiniKit.install()`. `MiniKit.isInstalled()` solo es `true` **dentro de World App**.
9. Condición de carrera conocida (FAQ): lanzar un comando en un `useEffect` separado nada más cargar puede fallar porque MiniKit aún no está instalado → los comandos de arranque van en el mismo efecto que `install()`.

## 3. Respuestas a la sección 8 del brief (login / identidad)

| # | Pregunta del brief | Respuesta según la documentación vigente |
|---|---|---|
| 1 | ¿Qué sirve para **autenticar**? | **`MiniKit.walletAuth()`** (Sign-In with Ethereum). ✅ La doc lo califica como el flujo de autenticación recomendado para Mini Apps. Se verifica **siempre en el backend** con `verifySiweMessage` (`@worldcoin/minikit-js/siwe`). |
| 2 | ¿Qué sirve para **demostrar humanidad**? | **World ID vía IDKit 4.x** (`@worldcoin/idkit`, preset `proofOfHuman`), verificado en backend contra `POST https://developer.world.org/api/v4/verify/{rp_id}`. ✅ **No son lo mismo**: la doc de Wallet Auth prohíbe expresamente usar la verificación de World ID como sustituto del login. |
| 3 | ¿Qué identificador guardar? | **`address` de la wallet (en minúsculas)** como identificador de autenticación + un **UUID interno** como clave primaria. Para humanidad: el **`nullifier`** (`NUMERIC(78,0)`, `UNIQUE(action, nullifier)`). |
| 4 | ¿Qué **NO** guardar? | El mensaje/firma SIWE tras verificar, IPs en claro, IDs de dispositivo, la prueba ZK completa, contactos, y **nunca** confiar en `MiniKit.user.*` (p. ej. `verificationStatus`, `walletAddress` sin firmar) como verdad: es estado del cliente. |
| 5 | Primer login | nonce en servidor → `walletAuth` → verificar SIWE → *upsert* de usuario → sesión propia. Ver `02-…` §7. |
| 6 | Logins posteriores | Sesión válida ⇒ `GET /api/me`. Si caducó ⇒ `walletAuth` de nuevo (World App muestra su hoja de firma). 🧪 medir la fricción real. |
| 7 | Sesiones | MiniKit **no** ofrece sesiones: las gestionamos nosotros (token opaco, hash en BD, revocable). |
| 8 | Logout / reconexión | Logout = revocar sesión + borrar cookie (World App no tiene «logout»). Reconexión = `walletAuth`. |
| 9 | Abrir desde World App | `MiniKit.isInstalled()`, `MiniKit.location` (`chat` · `home` · `app-store` · `deep-link` · `wallet-tab`), comparar `MiniKit.user.walletAddress` con la sesión (si difiere ⇒ cerrar sesión y reautenticar). Fuera de World App: aterrizaje + enlace/QR (ver `04-…`, A8). |

Datos útiles ✅: tras `walletAuth`, `MiniKit.user.username`/`profilePictureUrl` se rellenan; también existen
`MiniKit.getUserByAddress()`. 🔎 Internamente consulta `POST https://usernames.worldcoin.org/api/v1/query` con `{ addresses: [...] }`
(admite lotes), así que **el servidor puede resolver usernames por sí mismo** sin fiarse del cliente.

🔎 **Endurecimiento necesario:** `verifySiweMessage` comprueba nonce, expiración, `notBefore`, `statement`, `requestId`,
coincidencia de dirección y la firma (ECDSA, y **EIP-1271** para wallets inteligentes vía un cliente público de World Chain
por defecto), pero **no compara `domain`/`uri` ni `chainId`**. Añadiremos esa comprobación nosotros (🧪 confirmar qué
`domain` escribe World App). Además el RPC público por defecto puede limitar peticiones ⇒ en producción conviene pasar un
`viemClient` propio (implica un proveedor RPC; ver `04-…`).

## 4. World ID (IDKit 4.x) — lo que aplica a este juego

Flujo oficial de 6 pasos ✅ ([Integrate IDKit](https://docs.world.org/world-id/idkit/integrate)):
1) instalar IDKit `^4.x` · 2) crear app en el Developer Portal (`app_id`, `rp_id`, `signing_key` **secreta**) ·
3) **firmar la petición (RP signature) en el backend** · 4) abrir `IDKitRequestWidget` en el cliente ·
5) reenviar la prueba **tal cual** al endpoint `/api/v4/verify/{rp_id}` · 6) **guardar el nullifier** con restricción `UNIQUE`.

Puntos que condicionan el diseño:

- **El Portal acepta nullifiers repetidos** 🔎 (una verificación repetida tiene éxito y solo devuelve un aviso de reutilización). La unicidad
  «un humano ↔ una cuenta» **la tenemos que imponer nosotros** con `UNIQUE (action, nullifier)`.
- **Dentro de World App no se muestra QR:** IDKit usa el transporte nativo automáticamente ✅.
- **`signal`:** liga la prueba a un contexto (p. ej. nuestro `user.id`); el backend debe imponer ese mismo valor ✅.
  🧪 Cómo se comprueba exactamente el `signal_hash` con IDKit 4.x (helper de hash) no está en la prosa: verificar en Fase 2.
- **`allow_legacy_proofs`** es obligatorio en el widget ✅. Con `true` se aceptan pruebas 3.0 de usuarios sin credencial v4;
  🧪 **hay que confirmar con World** si un mismo humano puede producir un nullifier 3.0 *y* otro 4.0 para la misma acción
  (la guía de migración indica llevar el rastro de ambos tipos de nullifier durante la transición). Es relevante para no permitir doble alta.
- **Presets** ✅: `proofOfHuman` (Orb; el más fuerte), `passport`, `selfieCheckLegacy` (**beta, requiere pedir acceso**, solo 3.0,
  no apta como única garantía). Para este juego: `proofOfHuman`.
- **Entornos** ✅: producción ≠ *staging*. Un `action` *staging* solo verifica con el **Simulator** de World ID; para probar con
  el teléfono real la acción debe ser `production`. `environment` del widget, de la acción y del simulador **deben coincidir**.
- **Sesiones World ID 4.0** ✅ (`session_id`): para «usuario que vuelve». **No las necesitamos en la v1** (el login ya es la
  wallet). Se reevaluarán si algún día hay que re-verificar humanidad periódicamente.
- **Insignia oficial** ✅ ([Design Guidelines](https://docs.world.org/world-id/idkit/design-guidelines)): «human badge» (icono +
  etiqueta **human** en minúsculas); en **leaderboards** va *a la derecha del username*; **prohibido remezclar el texto**
  («real human», «verified user»…).
- La guía de gamificación de World ✅ recomienda que los leaderboards muestren solo usuarios verificados para evitar abusos, apoyándose en la garantía «una persona, una cuenta» de World ID.

## 5. Developer Portal: apps, entornos, ficha y revisión

### 5.1 Tipos de app y entornos 🔎 (fuente: SKILL/MCP del Developer Portal)

- Existen dos modos de app, **`mini-app`** y **`external`** (para IDKit), y **el modo se fija al crear** la app.
  La doc de IDKit para Mini Apps admite ambas configuraciones («*si* tu Mini App y tu integración de World ID usan apps del
  Portal separadas…»). 🧪 Comprobar en el Portal si una app `mini-app` puede alojar su propio RP (el flujo B del MCP dice que sí;
  otra guía dice que no). **El diseño mantiene variables separadas** (`WORLD_MINIAPP_ID` vs `WORLD_ID_APP_ID`/`RP_ID`) para que
  cualquiera de las dos respuestas funcione.
- Las apps creadas por el MCP son **de producción**; **las apps *staging* no se pueden enviar a revisión**.
- `MiniKit` **solo funciona dentro de World App** ✅ (FAQ). Probar en el teléfono: `https://worldcoin.org/mini-app?app_id=<id>`
  (QR) apuntando a una URL pública (túnel: ngrok, zrok o tunnelmole ✅) y configurada en el Portal. **Eruda** ayuda a ver logs.
- **No hay testnet ni simulador para transacciones** ✅: el desarrollo es en *mainnet* (el gas lo cubre World App).

### 5.2 Requisitos para enviar a revisión (lista completa) 🔎

**Siempre:** `name` · logo (PNG/JPEG **≤ 500 KB**) · `app_website_url` · `is_android_only` · `is_for_humans_only` ·
países soportados (≥ 1) · idiomas (**debe incluir `en`**) · `description_overview` · **≥ 1 captura (`showcase`) en inglés**.
**Adicional para Mini Apps:** `short_name` · `category` · `world_app_description` (eslogan) · imagen **content card** ·
`support_link` (URL `https://` o `mailto:`).
**Guías de imagen** ✅: icono **cuadrado, fondo no blanco**; content card **345×240 px** (exportar PNG a 3×), sin texto,
**dejar libres los 94 px inferiores** (los tapa la app).
**Ajustes avanzados** 🔎: `max_notifications_per_day` (`"0"`, `"1"`, `"2"` o `"unlimited"`), lista de contratos y tokens Permit2
permitidos (solo si hubiera transacciones), `can_use_attestation`, `associated_domains`.

### 5.3 Guías de revisión que nos afectan ✅ ([App Review Guidelines](https://docs.world.org/mini-apps/guidelines/policy))

- **Nombre:** prohíbe usar la palabra «World» en el nombre · sin marcas ajenas ni nombres de otras apps · sin emojis/caracteres especiales · corto y memorable. → **choca con «WORLD RUSH»** (ver §9-C1).
- **Marca:** prohibido «official» en nombre/descripción/UI; prohibido usar el **logo de World** o una versión modificada; no aparentar respaldo oficial.
- **Juegos de azar:** los juegos *chance-based* casi nunca se aprueban; **los premios deben ser por habilidad, no por azar/RNG**. (Un time-trial es por habilidad ✔.)
- **La app debe ser una versión final**, *no demo/prueba/beta*, con todo el texto y funcionalidad de su propósito, e **integración
  real y funcional de MiniKit o IDKit**.
- **Técnico:** funcionar con **mala conexión** y desconexiones; **sin cargas infinitas**; sin funciones no disponibles en una
  plataforma; **el progreso debe sincronizarse entre plataformas**.
- **Privacidad:** consentimiento antes de guardar datos; **minimización**. **Soporte:** email válido.
- **La app debe ser accesible para el equipo de revisión.** Si el ranking exige Orb, hay que darles un camino de prueba (🧪 a coordinar en Fase 12).

## 6. Plataforma y UX de la WebView ✅

- **iOS: WKWebView; Android: WebView nativo.** **Prohibido abrir ventanas nuevas.** **`alert()` no funciona en iOS.** **Zoom deshabilitado en iOS.**
  Cookies y almacenamiento DOM soportados, pero en Android requieren activación explícita (en iOS vienen activos) ⇒ 🧪 probar la cookie de sesión en Android.
- **Móvil primero:** navegación por **pestañas inferiores**, sin *footers*/barras laterales/menús hamburguesa, CTAs visibles, sin scroll excesivo.
- **iOS scroll bounce:** `overscroll-behavior: none` y `100dvh` (CSS oficial en la doc).
- **Carga:** objetivo **2–3 s** inicial y **< 1 s** en acciones posteriores.
- **Espaciado oficial:** padding 24 px; tab bar a 12 px de la barra del sistema; botones a 24 px del borde inferior/teclado.
  **No colocar elementos interactivos junto a los controles de la Mini App en la esquina superior derecha.**
- **Safe areas:** `MiniKit.deviceProperties.safeAreaInsets` (más `env(safe-area-inset-*)`).
- **Usernames:** mostrar username, **no** la dirección de wallet.
- **Idiomas recomendados:** inglés, español, tailandés, japonés, coreano, portugués (detectar con `Accept-Language`).
- **UI Kit opcional:** `@worldcoin/mini-apps-ui-kit-react`.
- **Analítica:** `MiniKit.user.optedIntoOptionalAnalytics` indica si el usuario aceptó analítica opcional → **la respetaremos**.
- **Capacidades:** `window.WorldApp.supported_commands` lista qué comandos existen (y versiones) → detectar en vez de asumir (p. ej. haptics).
- **Haptics** ✅: `MiniKit.sendHapticFeedback({hapticsType:'impact'|'notification'|'selection-changed', style})` (asíncrono; 🧪 medir latencia).
- **Permisos** ✅: `requestPermission` (notifications · contacts · microphone), `getPermissions()` no se carga solo. **No pediremos ninguno.**
- **Attestation** ✅: `MiniKit.attestation({requestHash})` devuelve un token de integridad; requiere `can_use_attestation` en el Portal.
  ❓ **La verificación del token en servidor no está documentada** → no cuento con ello como control anti-cheat hasta preguntar.

## 7. Notificaciones ✅ (no se activa nada)

Requisitos: (1) permiso en **Advanced settings del Developer Portal**, (2) **permiso del usuario** vía `MiniKit.requestPermission`,
(3) enviar por API `POST /api/v2/minikit/send-notification` con **API key secreta** (Bearer).
Límites: título ≤ 30 y mensaje ≤ 200 caracteres · ≤ 1000 direcciones por llamada · localizaciones por idioma · sustitución `${username}`
· apps sin verificar: **40 notificaciones cada 4 h** · tope diario configurado en el Portal (`0/1/2/unlimited`).
Política: deben ser puramente funcionales (no de marketing), relacionadas con la app y relevantes para el usuario. → Los tres ejemplos del brief
(«race is live», «closes in 2 h», «ranking changed») caben como funcionales, pero **el tope diario limitará cuántos** se pueden enviar (§9-C5).
Estado: **desactivadas hasta que las apruebes.**

## 8. Pagos y transacciones ✅ (solo diseño futuro; no se solicita ni ejecuta nada)

- **`Pay`**: transferencia **del usuario a una dirección** (WLD y stablecoins locales); se verifica en backend con
  `GET /api/v2/minikit/transaction/{id}` + API key. **No sirve para pagar premios *a* jugadores.**
- **`sendTransaction`**: el *usuario* firma; requiere **lista blanca** de contratos/tokens en el Portal (`invalid_contract` si no);
  Permit2 AllowanceTransfer; la promesa `userOpHash` no es el hash final (hay que consultarlo).
- **Repartir premios (app → jugador)** exigiría un contrato de reclamo (p. ej. Merkle) o una wallet de tesorería en servidor
  con clave privada. **Es una decisión de arquitectura y custodia para más adelante.** Las guías de contratos de World exigen
  contratos de custodia **inmutables, sin retirada por el owner, con tests ≥ 90 % y código compartido con World antes de desplegar**.
- Sin testnet: probar cuesta gas real en *mainnet*.
- Premios por **habilidad**, nunca por azar (§5.3). Los «Mystery rewards» de la guía de gamificación de World serían *chance-based*: **evitarlos**.

## 9. Conflictos entre el brief y la documentación (requieren tu decisión)

| ID | Conflicto | Evidencia | Impacto | Propuesta |
|---|---|---|---|---|
| **C1** | **Nombre «WORLD RUSH»**, logo con globo, pie «BUILT FOR WORLD», etiqueta «Verified with World ID» | Prohibido «World» en el nombre; prohibido «official»/aparentar respaldo; insignia oficial *human* sin remezclar texto | **Riesgo alto de rechazo** y el wordmark ya está en el arte | Mantener «WORLD RUSH» solo como *codename* interno y **elegir nombre público antes de producir arte** (pregunta A1) |
| **C2** | El brief da por hecho «World ID vía MiniKit» | `MiniKit.verify` eliminado en 2.x | Hay **dos secretos más** (`RP_SIGNING_KEY`, API key del Portal) y un flujo aparte | IDKit 4.x, flujo separado del login |
| **C3** | Usar World ID como login | La doc de Wallet Auth lo prohíbe expresamente | — | Login = `walletAuth`; humanidad = IDKit |
| **C4** | Tres entornos totalmente separados | MiniKit solo en World App; apps MCP = producción; staging no se envía a revisión; World ID staging = simulador; sin testnet | Probar en el teléfono exige túnel/URL pública y apps de Portal distintas | Apps de Portal separadas por entorno + BD y secretos separados + guarda `system_meta` en la BD |
| **C5** | 3 notificaciones/día | Tope `0/1/2/unlimited` y política «solo funcionales» | Menos mensajes de los previstos | Diseñar con 1–2/día; no activar (D3) |
| **C6** | Pestaña **REWARDS «COMING SOON»** | La app debe ser *final, no demo/beta* y completa | Posible rechazo | Ocultarla con *feature flag* hasta que exista (pregunta A7) |
| **C7** | Pie «A MORE HUMAN INTERNET THROUGH PLAY / BUILT FOR WORLD» | «Avoid footers»; no aparentar afiliación oficial | Riesgo medio | Retirarlo o reformularlo sin «World» |
| **C8** | «Verified with World ID» como chip de cabecera | La insignia oficial es *human* junto al username | Riesgo bajo | Usar la insignia oficial junto al nombre |
| **C9** | Premios/«campeón» futuros | Solo premios por habilidad | Condiciona la fórmula semanal | Sin componentes aleatorios (pregunta A5) |
| **C10** | Haptics «si MiniKit lo permite» | Existe; pero «sin funciones no disponibles en una plataforma» | — | Detectar con `supported_commands` y degradar en silencio |

## 10. Lo que NO he podido verificar (y cómo lo cerraré)

| # | Duda | Marca | Cómo |
|---|---|---|---|
| 1 | ¿Una app `mini-app` puede alojar el RP de World ID? | 🧪 | Portal (Fase 2) |
| 2 | Comprobación del `signal_hash` con IDKit 4.x | 🧪 | Fase 2, código de `@worldcoin/idkit-core` |
| 3 | `allow_legacy_proofs` y doble nullifier 3.0/4.0 para un mismo humano | ❓ | Preguntar a World antes de la Fase 3 |
| 4 | Semántica de `expires_at_min` (caducidad de credencial) | ❓ | Preguntar a World |
| 5 | Verificación en servidor del token de `attestation` | ❓ | Preguntar a World |
| 6 | Qué `domain` escribe World App en el SIWE | 🧪 | Fase 3 en dispositivo real |
| 7 | Fricción de `walletAuth` en cada apertura | 🧪 | Fase 3 |
| 8 | Cookies de sesión en la WebView de Android | 🧪 | Fase 3 (iPhone y Android) |
| 9 | Latencia/frecuencia máxima de `sendHapticFeedback` | 🧪 | Fase 5 |
| 10 | ¿Se puede bloquear orientación? Rendimiento de WASM en gama baja | 🧪 | Spike de Fase 5 |
| 11 | ¿Aceptará la revisión una pestaña con contenido «próximamente»? | ❓ | Evitarlo (C6) |
| 12 | Campos de la ficha que solo estén en el dashboard (política de privacidad, términos) | 🧪 | Revisar el formulario real del Portal en Fase 12 |
| 13 | Compatibilidad Next.js 16 con las plantillas/paquetes | 🧪 | Fase 2 (fallback: Next 15) |

## 11. Fuentes

Documentación (`docs.world.org`): [índice](https://docs.world.org/llms.txt) ·
[Mini Apps – Getting started](https://docs.world.org/mini-apps/quick-start/installing) ·
[Initialization](https://docs.world.org/mini-apps/quick-start/init) · [Responses](https://docs.world.org/mini-apps/quick-start/responses) ·
[Wallet Authentication](https://docs.world.org/mini-apps/commands/wallet-auth) ·
[MiniKit 2.0 Migration](https://docs.world.org/mini-apps/migration/minikit-v2) ·
[IDKit for Mini Apps](https://docs.world.org/world-id/idkit/mini-apps) · [Integrate IDKit](https://docs.world.org/world-id/idkit/integrate) ·
[World ID 4.0](https://docs.world.org/world-id/4-0-migration) · [Credentials](https://docs.world.org/world-id/idkit/credentials) ·
[Verify API](https://docs.world.org/api-reference/developer-portal/verify) · [SKILL World ID](https://docs.world.org/world-id/SKILL) ·
[App Review Guidelines](https://docs.world.org/mini-apps/guidelines/policy) · [App Guidelines](https://docs.world.org/mini-apps/guidelines/app-guidelines) ·
[Design Guidelines](https://docs.world.org/mini-apps/guidelines/design-guidelines) · [Webview Specifications](https://docs.world.org/mini-apps/more/webview-spec) ·
[Notifications](https://docs.world.org/mini-apps/commands/how-to-send-notifications) · [Pay](https://docs.world.org/mini-apps/commands/pay) ·
[Send Transaction](https://docs.world.org/mini-apps/commands/send-transaction) · [Smart contract guidelines](https://docs.world.org/mini-apps/guidelines/smart-contract-development-guidelines) ·
[FAQ](https://docs.world.org/mini-apps/more/faq) · [Gamification](https://docs.world.org/mini-apps/growth/gamification) ·
[Developer Portal MCP](https://docs.world.org/model-context-protocol/developer-portal).
Otros: [anuncio MiniKit 2.0](https://world.org/blog/announcements/build-once-deploy-anywhere-minikit-2.0-is-live-for-world-developers) ·
[`worldcoin/developer-portal` (MCP)](https://github.com/worldcoin/developer-portal/tree/main/web/api/mcp) ·
paquete npm `@worldcoin/minikit-js@2.0.3` (inspeccionado) · registro de npm.
