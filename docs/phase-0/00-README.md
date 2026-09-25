# Fase 0 — Descubrimiento y propuesta (sin código de producto)

> **Actualización 2026-09-20:** ya respondiste A1, B1, C1, D1, E1, F1, G1 y H1, y con E1 (stack aprobado) arrancó la **Fase 1**.
> Lo vigente vive en [`../DECISIONS.md`](../DECISIONS.md); si algo de estos documentos difiere de ese archivo, **manda ese archivo**.
> Cambios que ya se reflejan allí: base de datos en Vercel (Neon vía Marketplace), hosting en Vercel, TypeScript 6.0.3 (no 7) y aviso
> sobre el nombre («Seven Rush» existe en Google Play).

**Estado:** propuesta para tu revisión. **No se ha escrito código de producto, creado cuentas, conectado servicios, usado claves,
desplegado nada ni tocado ninguna wallet.** Lo único que se ejecutó fuera de esta carpeta fue lectura de documentación pública,
consultas al registro de npm y pruebas desechables en una carpeta temporal (mediciones de tamaño de motores y validación del SQL).

Nombre de trabajo: **WORLD RUSH** (provisional; el nombre público está por decidir: pregunta A1).

## Orden de lectura

| # | Documento | Qué responde |
|---|---|---|
| 1 | [`04-decisions-and-questions.md`](04-decisions-and-questions.md) | **Lo que necesito de ti** (30 decisiones A–H, solo 5 bloqueantes), servicios/cuentas/claves y permisos |
| 2 | [`01-world-docs-review.md`](01-world-docs-review.md) | Qué dice la documentación **vigente** de World, qué cambió (MiniKit 2.x, IDKit 4.x), **conflictos con el brief** y lo que no pude verificar |
| 3 | [`02-architecture-proposal.md`](02-architecture-proposal.md) | Stack, carpetas, motor (con tamaños medidos), controles, flujos de login / partida / validación, anti-cheat, entornos, seguridad, fases |
| 4 | [`03-database-schema-proposal.md`](03-database-schema-proposal.md) + [`schema-proposal.sql`](schema-proposal.sql) | Esquema de BD **validado en PostgreSQL 18** (51 comprobaciones), consultas del leaderboard, concurrencia, rendimiento medido |
| 5 | [`05-world-miniapp-checklist.md`](05-world-miniapp-checklist.md) | Checklist de requisitos de World (76 filas, **0 cumplidas**) |
| — | [`evidence/schema-validation.mjs`](evidence/schema-validation.mjs) | Cómo reproducir la validación del esquema |

## Leyenda de evidencia (usada en todos los documentos)

✅ confirmado en documentación oficial · 🔎 confirmado leyendo código/paquetes públicos · 🧪 por verificar en dispositivo/Portal/spike · ❓ no documentado (preguntar a World)
