# Reporte de Decisiones Arquitectónicas — BetaMallSport

> **Fecha:** 2026-04-28
> **Autor:** Felipe Guzmán
> **Versión:** 1.0 (borrador para reunión 1-a-1)
> **Audiencia:** Jefatura técnica / negocio
> **Lenguaje:** español, técnico-accesible

---

## 0. Contexto y objetivos

**¿Qué es BetaMallSport?** Plataforma SaaS para gestionar la operación inmobiliaria de un mall: contratos de arriendo, facturación esperada, ventas reales y la reconciliación entre ambos mundos.

**¿Por qué esta reunión?** El producto pasó de "un proyecto piloto" a "una plataforma con 3 mundos formalizados (Plan / Real / Reconciliación), 5K LOC en pipeline de uploads, 30+ endpoints REST y modelos bitemporales en tarifas". Antes de seguir agregando features de negocio, conviene cerrar decisiones arquitectónicas que de quedar pendientes generan retrabajo.

**Decisiones que se buscan cerrar HOY (orden de prioridad):**
1. **2.1** Excel canónico vs API/integración para ingestion
2. **2.5** Snapshots persistidos para Plan
3. **2.6** Multi-proyecto vs multi-tenant real
4. **2.4** Política de archivos rechazados y reintentos
5. **2.13** Permisos por proyecto
6. **2.7** Retención y versionado de Excels originales

**Decisiones que se difieren explícitamente** (mencionadas pero no se debaten hoy):
- 2.10 Capa de dominio explícita (refactor mayor — no urgente, deuda manejable)
- 2.11 tRPC/GraphQL vs REST (REST funciona, no hay dolor real hoy)
- 2.12 Observabilidad avanzada (Sentry/Datadog — depende de presupuesto)
- 2.9 Separación 3 mundos a nivel de schema DB (problema de leak existe pero hay solución intermedia)

**Restricciones asumidas (validar):**
- Equipo: 1 dev (yo) en horizonte 6 meses
- Stack lock-in: Next.js + Prisma + Postgres + Cloud Run (no se cambia)
- Escala: 1–5 malls, ~150 contratos por mall, ~2K filas de upload máx por archivo
- Presupuesto Cloud: bajo (Neon free tier hoy, Cloud Run pay-per-request)

---

## 1. Mapa del estado actual

```
┌─────────────────────────────────────────────────────────────────┐
│  UI (Next.js App Router · React Server Components)              │
│  ─ /plan   ─ /real   ─ /reconciliation   ─ /admin               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│  API Routes (~65 endpoints, ~95% adherencia a CLAUDE.md)        │
│  /api/{plan,real,reconciliation}/*  +  /api/{contracts,units...}│
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│  Domain layer (mezclado con infraestructura en src/lib/*)       │
│  src/lib/plan/  ─ src/lib/real/  ─ src/lib/contracts/  ─ kpi.ts │
│  Pipeline uploads: parser → preview → apply (5,174 LOC)         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│  Persistencia                                                    │
│  Postgres (Neon) ─ 30 modelos Prisma ─ bitemporal en tarifas    │
│  GCS (PDFs de contratos) ─ NO archivos Excel (solo en memoria)  │
│  Job queue: tabla DataUpload + worker manual /api/jobs/worker    │
└─────────────────────────────────────────────────────────────────┘
```

**Modelos Prisma críticos por dominio (30 totales):**

| Dominio | Modelos clave |
|---|---|
| Master | `Project`, `Unit`, `Tenant`, `Zone`, `ValorUF` |
| Contractual | `Contract`, `ContractUnit`, `ContractRate` *(bitemporal)*, `ContractRateDiscount` *(bitemporal)*, `ContractCommonExpense` *(bitemporal)*, `ContractAmendment`, `ContractDay` |
| Plan | `TenantBudgetedSale`, `ExpenseBudget` |
| Real | `TenantSale`, `AccountingRecord`, `BalanceRecord`, `BankMovement`, `IngresoEnergia` |
| Reconciliación | `BillingAlert`, `AccountingUnitMapping`, `SalesTenantMapping` |
| Audit | `DataUpload` |
| Auth/Config | `User`, `Account`, `Session`, `VerificationToken`, `CustomWidget`, `DashboardConfig` |

**Tipos de upload soportados (madurez):**

| Tipo | Parser | Apply | Madurez |
|---|---|---|---|
| `UNITS` | ✅ `parse-units.ts` | ✅ | **P0** producción |
| `TENANTS` | ✅ `parse-tenants.ts` | ✅ | **P0** producción |
| `RENT_ROLL` | ✅ `parse-contracts.ts` (1.425 LOC) | ✅ | **P0** producción |
| `SALES` | ✅ `parse-sales.ts` | ❌ | **P2** sólo preview |
| `ACCOUNTING` | ✅ `parse-accounting.ts` | 🟡 mapping-only | **P2** parcial |
| `BALANCES` | ✅ `parse-balances.ts` | ❌ | **P2** sólo preview |
| `BANK` | ✅ `parse-bank.ts` | ❌ | **P2** sólo preview |
| `BUDGETED_SALES` | ✅ `parse-budgeted-sales.ts` | ❌ | **P2** sólo preview |
| `EXPENSE_BUDGET` | ✅ `parse-expense-budget.ts` | ❌ | **P2** sólo preview |

> 🚩 **Brecha crítica**: 5 de 9 tipos de upload no escriben en DB. El operador "carga" archivos que no se persisten en entidades de dominio. Es la deuda más visible del producto.

**Inventario de deuda detectada:**

| Categoría | Evidencia | Severidad |
|---|---|---|
| Plan importa de Real (`billing-utils`) | `src/lib/plan/{budget-vs-actual,metrics,rent-roll-snapshot}.ts` → `@/lib/real/billing-utils` | Alta |
| Reconciliación sin lib propia | Lógica vive en `src/lib/real/reconciliation.ts`, ruta en `/api/real/reconciliation/` | Media |
| `parse-contracts.ts` 1.425 LOC | Excede 500 LOC del CLAUDE.md; mezcla detección de formato + parsing + reconciliación + tarifas + GGCC | Media |
| `Contract` con campos deprecados in-place | `pctAdministracionGgcc` (línea 287), `cuentaParaVacancia`/`diasGracia` sin historia | Media |
| `.parse()` en lugar de `.safeParse()` | `src/app/api/contracts/[id]/route.ts:307` (PUT handler) | Baja (fix simple) |
| Excels NO se persisten | `parse-utils.ts` lee a memoria; `fileUrl` es placeholder | Alta para auditoría |
| Sin deduplicación por checksum | DataUpload no guarda hash; mismo archivo cargado 2× crea duplicados | Alta |
| Sin tests apply | `contracts-apply-job.ts`, `contracts-apply-service.ts` (~900 LOC sin tests) | Media |
| Cascade peligroso GL | `AccountingRecord` cascade `Unit` y `Project` (línea 574–576) | Alta |
| Decimales inconsistentes | `Decimal(10,2)` vs `(14,4)` vs `(18,2)` sin política documentada | Media |
| `Contract.localId` + `ContractUnit` join | Dual-modeling sin documentación de cuándo usar cuál | Media |

---

## 2. Decisiones pendientes

### Ingestion

#### 2.1 ¿Excel canónico o agregamos API/integración directa?

- **Contexto.** Hoy todo entra por Excel. 9 tipos definidos en `DataUploadType`. El operador exporta de su sistema contable (a veces SAP), arma el archivo, lo sube a la app. Pipeline en `src/lib/upload/*` (5.174 LOC). Funciona para Plan (UNITS, TENANTS, RENT_ROLL en P0). Para Real está incompleto (5/9 tipos sin apply).

- **Opciones:**
  - **A) Mantener Excel canónico, completar los 5 apply faltantes.** Pros: es lo que el operador entrega hoy, no requiere acuerdo con su área de TI; aprovecha pipeline existente. Cons: cada cambio de columna en el Excel rompe el parser; columnas hardcodeadas en strings (`parse-contracts.ts:16-24`); validación frágil. Costo: bajo. Riesgo: bajo. Esfuerzo: **M** (~2–3 semanas para los 5 faltantes).
  - **B) API directa + Excel como respaldo.** Construir endpoints REST `/api/v1/sales`, `/api/v1/accounting` que el sistema contable del operador llama. Excel queda como fallback manual. Pros: integración real-time, valida en tiempo de escritura, elimina re-trabajo mensual. Cons: requiere coordinación con TI del operador (ellos tienen que mover su lado); la API debe ser super estable (versión semántica). Costo: medio (esfuerzo cruzado). Riesgo: medio (dependencia externa). Esfuerzo: **L** (2–3 meses si TI del operador acompaña).
  - **C) Connector ETL dedicado (Fivetran/Airbyte/script).** Un proceso intermedio lee del SAP del operador, transforma, llama nuestra API. Pros: desacopla horarios. Cons: agrega un componente nuevo a operar; costo licencia. Costo: alto. Riesgo: alto. Esfuerzo: **L+** (3+ meses).

- **Trade-offs clave:** velocidad de entrega · acoplamiento con TI del operador · costo operacional.

- **Recomendación:** **A** ahora, **B** en H2-2026. Razón: la app no puede entregar su valor mientras 5 tipos sigan en P2. La integración API es lo correcto a mediano plazo, pero requiere un compromiso del operador que hoy no existe. Cerrar la brecha de apply primero, conversar la integración después.

- **Reversibilidad:** *Two-way door*. Pasar de Excel a API es aditivo, no destructivo.

- **Pregunta para el jefe:** ¿hay apetito (presupuesto y voluntad política) para empujar una integración API con el sistema contable del operador en H2-2026, o asumimos que Excel es la entrada por años?

---

#### 2.2 ¿Modelo preview→apply escala o necesitamos job-queue real?

- **Contexto.** Hoy el apply corre **sincrónico dentro del request HTTP**. Cloud Run tiene timeout 60s. El pipeline ya usa transacción Prisma con `timeout: 60_000ms` (`contracts-apply-service.ts`). Existe un esqueleto de job queue en `/api/jobs/worker/route.ts` y modelo `Job`, pero el worker se invoca manualmente — no hay scheduler permanente. Flag `?sync=true` decide si correr inline.

- **Opciones:**
  - **A) Mantener sync, optimizar transacción.** Pros: simple, no requiere infra extra. Cons: cap duro de 60s; archivos grandes (>1.5K filas con tarifas + GGCC) ya rozan el límite. Costo: bajo. Riesgo: medio (timeouts en producción cuando crezca el rent roll). Esfuerzo: **S**.
  - **B) Cloud Tasks + worker existente.** Reusar el modelo `Job` que ya existe; el endpoint `/api/jobs/uploads` enqueue, Cloud Tasks dispara `/api/jobs/worker`. Pros: usa infra Google nativa; pocas piezas nuevas. Cons: hay que terminar el wiring (scheduler, retries, dead-letter). Costo: bajo (Cloud Tasks free tier generoso). Riesgo: bajo. Esfuerzo: **M** (~1 semana).
  - **C) BullMQ + Redis (Upstash) o Inngest.** Pros: ecosistema rico, buenas dashboards, retries declarativos. Cons: dependencia externa (Redis o servicio Inngest), costo recurrente. Costo: medio. Riesgo: medio (otra cosa que monitorear). Esfuerzo: **M+**.

- **Trade-offs clave:** límite de tiempo Cloud Run · costo operacional · complejidad de infra.

- **Recomendación:** **B**. Ya existe el 60% del trabajo (modelo Job + endpoint worker). Cloud Tasks es la pieza faltante y es free para nuestros volúmenes. Inngest/BullMQ son over-engineering hoy.

- **Reversibilidad:** *Two-way door*. Migrar de Cloud Tasks a BullMQ es trivial si el dolor aparece.

- **Pregunta para el jefe:** ninguna específica — esto es decisión técnica. ¿Estás de acuerdo con Cloud Tasks o tenés preferencia por otra ruta?

---

#### 2.3 Validación: schema-first vs row-by-row

- **Contexto.** Hoy cada parser implementa validadores custom inline (`parse-units.ts`, `parse-tenants.ts`, `parse-contracts.ts`). El resto de la app sí usa Zod (CLAUDE.md sección 7), pero el upload pipeline NO. Resultado: validación inconsistente, mensajes de error variables, lógica duplicada (`normalizeToken`, `asString` repetidos en 3 archivos).

- **Opciones:**
  - **A) Mantener row-by-row custom.** Pros: control total, mensajes en español natural. Cons: mantenibilidad; cada nuevo upload duplica código. Costo: 0 (status quo). Riesgo: alto a 12 meses (parsers se vuelven inmanejables). Esfuerzo: **0**.
  - **B) Migrar a Zod schemas con `safeParse` por fila.** Definir un `unitsRowSchema`, `tenantsRowSchema`, etc. Reusa la convención Zod del resto de la app. Pros: consistente con CLAUDE.md; mensajes estructurados; tipo inferido. Cons: refactor de 3K LOC. Costo: medio. Riesgo: medio (regresiones en parsing). Esfuerzo: **L** (~3–4 semanas con tests).
  - **C) Híbrido: Zod para shape + validadores custom para reglas de negocio.** Pros: balance pragmático. Cons: más conceptos a explicar. Costo: medio. Riesgo: bajo. Esfuerzo: **M+**.

- **Trade-offs clave:** consistencia con la app · costo de migración · velocidad para sumar nuevos uploads.

- **Recomendación:** **C** progresivo. Empezar por los uploads que faltan (P2 → P0): que esos nazcan con Zod. Migrar UNITS/TENANTS/RENT_ROLL solo cuando se toquen por otra razón.

- **Reversibilidad:** *Two-way door*.

- **Pregunta para el jefe:** ninguna — decisión técnica.

---

#### 2.4 ¿Qué hacemos con archivos rechazados?

- **Contexto.** Hoy: si una fila falla validación, va a `rejectedRows[]` en el reporte. El usuario ve los errores **en pantalla**, pero el archivo original se pierde (vive solo en memoria). No hay retry, no hay edición inline, no hay forma de recuperar el contexto si el operador cierra la pestaña. La tabla `DataUpload` guarda preview JSON (~filas + summary) pero no el blob original.

- **Opciones:**
  - **A) Status quo.** Pros: simple. Cons: si una carga de 1.500 filas tiene 20 errores, el operador tiene que abrir Excel, corregir, re-subir; el preview se computa de cero. Costo: 0. Riesgo: medio (UX frustrante en cargas grandes). Esfuerzo: **0**.
  - **B) Persistir Excel original en GCS + edición inline de filas erradas.** Subir el archivo a GCS, guardar URL en `DataUpload.fileUrl` (hoy es placeholder), permitir editar las filas con error en la UI sin re-subir. Pros: UX significativamente mejor; archivos quedan auditados. Cons: agregar GCS upload al request; UI nueva para edición. Costo: medio. Riesgo: bajo. Esfuerzo: **L**.
  - **C) Solo persistir Excel en GCS (sin edición inline).** Pros: gana auditoría a costo bajo. Cons: la frustración de re-editar y re-subir persiste. Costo: bajo. Riesgo: bajo. Esfuerzo: **S**.

- **Trade-offs clave:** UX para el operador · costo storage · esfuerzo de UI.

- **Recomendación:** **C** ahora (auditoría gana mucho con poco esfuerzo), **B** después si el operador se queja de la UX. Mientras tanto, **agregar checksum SHA-256** al `DataUpload` para detectar re-subidas idénticas.

- **Reversibilidad:** *Two-way door*.

- **Pregunta para el jefe:** ¿el equipo operativo se quejó de re-subir archivos? ¿Es dolor real o teórico?

---

### Storage

#### 2.5 ¿Promovemos snapshots persistidos para Plan?

- **Contexto.** Hoy el rent roll del Plan se reconstruye **en vivo** desde `Contract` + `ContractRate` (bitemporal). Si una tarifa se enmienda hoy con efecto a febrero, el rent roll de febrero **se reescribe**. La consulta histórica "¿cómo se veía el rent roll el 1° de marzo?" funciona con `vigenciaDesde/Hasta` + `supersededAt`, pero NO existe un snapshot persistido del KPI calculado (renta total, GLA arrendado, % vacancia). Cualquier reporte mensual congelado se vuelve a calcular cada vez. La función `buildRentRollSnapshotRows()` corre on-demand.

- **Opciones:**
  - **A) Status quo (vivo + bitemporal en tarifas).** Pros: una sola fuente de verdad; correcciones se reflejan automáticamente. Cons: imposible mostrar "esto fue lo que reportamos al directorio en marzo"; performance degrada con historia. Costo: 0. Riesgo: alto cuando el operador empiece a usar reportes legales/auditados. Esfuerzo: **0**.
  - **B) Snapshot table congelada por mes (`RentRollMonthlySnapshot`).** Una tabla nueva con (`projectId`, `period`, `frozenAt`, payload JSON con KPIs). Job mensual congela el cierre. Pros: reportes históricos estables; performance excelente. Cons: complejidad de "¿qué pasa si encuentro un error en un mes ya congelado?"; doble fuente de verdad. Costo: medio. Riesgo: medio. Esfuerzo: **M**.
  - **C) Materialized views Postgres por período.** Pros: cerca del DB, refresh declarativo. Cons: lock-in con Postgres específico; Prisma no orquesta bien materialized views. Costo: bajo. Riesgo: medio. Esfuerzo: **M**.

- **Trade-offs clave:** reportabilidad histórica · complejidad de doble fuente de verdad · performance.

- **Recomendación:** **B** pero **selectivo**: solo congelar el output del KPI principal (rent roll mensual con renta total y % ocupación), NO toda la grilla. Política: snapshot al cierre del mes (día 5 del siguiente) tras "freeze contable" del operador. Edits posteriores requieren amendment formal (no edit silencioso).

- **Reversibilidad:** *One-way door operacional* (una vez que el operador depende del snapshot, no se puede sacar). Técnicamente reversible.

- **Pregunta para el jefe:** ¿el operador necesita **reportes auditables congelados** (el directorio firma "renta marzo = X"), o le sirve que los KPIs históricos puedan re-calcularse?

---

#### 2.6 Multi-proyecto vs multi-tenant real

- **Contexto.** Hoy: una sola instancia con N `Project` aislados por `projectId`. Auth via Google OAuth con whitelist `ALLOWED_EMAIL_DOMAIN` (un dominio). Toda query tenant-scoped filtra por `where: { projectId }`. No hay aislamiento de DB por tenant. Si mañana un cliente externo (otro mall) quiere usar la plataforma, hoy NO se puede sin abrir su correo a nuestro Google Workspace.

- **Opciones:**
  - **A) Mantener multi-proyecto interno (1 mall = 1 Project).** Pros: simple, ya funciona. Cons: no se puede vender a otro operador sin compartir cuenta. Costo: 0. Riesgo: depende de si querés vender. Esfuerzo: **0**.
  - **B) Multi-tenant lógico: agregar `Tenant` (org) sobre `Project`.** Cada org tiene N proyectos. Auth con email whitelist por org. Aislamiento por `tenantId` en cada query. Pros: vendible; cambios incrementales; misma DB. Cons: cada query gana un join; row-level security en DB es opcional pero deseable. Costo: medio. Riesgo: medio (errores de aislamiento son críticos). Esfuerzo: **L** (~6 semanas, incluye auditoría de seguridad).
  - **C) Multi-tenant físico: schema-per-tenant en Postgres.** Pros: aislamiento fuerte; escala bien. Cons: deploys complejos, migraciones x N schemas, Prisma no tiene buen support para multi-schema dinámico. Costo: alto. Riesgo: alto. Esfuerzo: **XL**.

- **Trade-offs clave:** modelo de negocio (vendible vs interno) · costo migración · riesgo de fuga de datos.

- **Recomendación:** **A** si BetaMallSport queda interno. **B** si hay plan de vender en H2-2026. **C** nunca (overkill para nuestra escala).

- **Reversibilidad:** *One-way door*. Decidir que sí/no es vendible determina el rumbo de los próximos 6 meses.

- **Pregunta para el jefe:** ¿esto es producto interno (1 cliente) o producto SaaS vendible (N clientes)? Esta es **la decisión arquitectónica más cara** del año si la equivocamos.

---

#### 2.7 Almacenamiento de archivos: ¿qué hacemos con los Excels originales?

- **Contexto.** Hoy: PDFs de contratos van a GCS (`MAX_PDF_BYTES=10MB`); Excels NO van a ningún lado — se leen a `ArrayBuffer` y se descartan. `DataUpload.fileUrl` es un placeholder string. No hay versionado, no hay retención.

- **Opciones:**
  - **A) Status quo.** Cons: sin auditoría sobre qué se cargó.
  - **B) Subir a GCS con retención de 12 meses.** Path: `gs://betamall/excel-uploads/{projectId}/{yyyy-mm}/{cargaId}-{filename}`. Lifecycle policy elimina >12 meses. SHA-256 en `DataUpload.fileChecksum` para deduplicación. Costo: muy bajo (~ centavos al mes para nuestra escala). Esfuerzo: **S**.
  - **C) Subir a GCS + versionado por carga (no eliminar nunca).** Cons: storage crece sin límite; mayoría de archivos nunca se vuelven a abrir.

- **Recomendación:** **B**. Retención 12 meses, checksum, eliminación con lifecycle. Cumple auditoría y es barato.

- **Reversibilidad:** *Two-way door*.

- **Pregunta para el jefe:** ¿hay requerimiento legal/contractual de retener archivos cargados? (Chile no exige, pero el operador puede tenerlo en su política).

---

#### 2.8 Backups: ¿alcanzan los snapshots de Neon o exportamos a GCS?

- **Contexto.** Neon ofrece point-in-time-recovery 7 días en plan free, 30 días en plan paid. No hay export periódico a GCS. Si Neon cae como proveedor (improbable pero posible) o si cambiamos de provider, no tenemos un dump independiente.

- **Opciones:**
  - **A) Confiar en Neon PITR.** Pros: 0 esfuerzo. Cons: lock-in con Neon; ventana 7 días en free.
  - **B) Cron diario `pg_dump` → GCS, retención 30 días + 1 mensual permanente.** Cloud Run job. Costo trivial. Esfuerzo: **S** (~1 día).
  - **C) Replicación a otra DB.** Overkill para nuestro tamaño.

- **Recomendación:** **B**. Es seguro de hacer hoy, no tiene desventaja, y nos cubre si Neon o nosotros nos equivocamos.

- **Reversibilidad:** *Two-way door*.

- **Pregunta para el jefe:** ninguna. Lo hago.

---

### Estructura

#### 2.9 Separación 3 mundos: ¿directorios bastan o necesitamos algo más fuerte?

- **Contexto.** Hoy los 3 mundos viven separados por carpeta: `src/lib/{plan,real,reconciliation}/*`, `src/app/api/{plan,real}/*`, `src/components/{plan,real,reconciliation}/*`. **Pero hay leak**: `Plan` importa de `Real` (`billing-utils`) en 5 archivos. Reconciliación NO tiene `lib/` propia (vive en `lib/real/reconciliation.ts`). El endpoint reconciliación está bajo `/api/real/reconciliation/` en lugar de `/api/reconciliation/`.

- **Opciones:**
  - **A) Status quo (carpetas + convención).** Cons: leaks documentados existirán y crecerán con cada commit.
  - **B) Refactor mínimo: extraer utilidades shared.** Mover `billing-utils.ts` (las partes mundo-agnósticas: `periodKey`, `shiftPeriod`, `toNum`, `DecimalLike`) a `src/lib/shared/period-utils.ts`. Crear `src/lib/reconciliation/` y mover lógica desde `src/lib/real/reconciliation.ts`. Mover endpoint a `/api/reconciliation/`. Costo: medio. Esfuerzo: **M** (1 semana, mucho rename).
  - **C) Aislamiento por paquete (monorepo nx/turborepo).** Pros: imports prohibidos por config. Cons: agrega ceremonia; el dolor real no justifica. Costo: alto. Riesgo: alto. Esfuerzo: **L+**.
  - **D) Schemas Postgres separados por mundo.** Pros: aislamiento físico. Cons: queries cross-mundo (reconciliación) se vuelven dolorosas; Prisma multi-schema es frágil. Esfuerzo: **L**. **No recomendado**.

- **Recomendación:** **B**. Es deuda real, fix tiene costo limitado, beneficio claro (reconciliación queda con casa propia).

- **Reversibilidad:** *Two-way door*.

- **Pregunta para el jefe:** ¿prioridad alta o baja? Es 1 semana de refactor sin features visibles.

---

#### 2.10 ¿Capa de dominio explícita?

- **Contexto.** Hoy `src/lib/*` mezcla domain (lógica de negocio) con infraestructura (Prisma queries, Excel parsing). No hay separación application/domain explícita. Para la escala actual (1 dev) esto es manejable; refactorizar a clean-architecture sería simbólico.

- **Recomendación:** **No tocar ahora**. Volver a evaluar si el equipo crece a 3+ devs. Diferir.

- **Pregunta para el jefe:** ¿planeás contratar? Si sí, replantear en 6 meses.

---

#### 2.11 ¿REST sigue o vamos a tRPC/GraphQL?

- **Contexto.** REST funciona, ~95% adherencia a CLAUDE.md (1 violación menor en `.parse()` vs `.safeParse()`, 1 inconsistencia de pagination shape). El boilerplate de tipos no es un dolor real (Zod schemas + types inferidos cubre).

- **Recomendación:** **No tocar**. Diferir indefinidamente. tRPC sería bonito pero no resuelve un problema vigente.

- **Pregunta para el jefe:** ninguna.

---

### Operación

#### 2.12 Observabilidad

- **Contexto.** Hoy hay un `logger` custom con `logDuration`, `logError`. Cloud Run ingesta a Cloud Logging gratis. No hay APM ni alertas estructuradas.

- **Opciones:**
  - **A) Cloud Logging + alertas básicas (Error rate >5%).** Costo: 0. Esfuerzo: **S**.
  - **B) Sentry para errores frontend + backend.** Costo: free tier ~5K eventos/mes. Esfuerzo: **S**.
  - **C) Datadog full APM.** Costo: USD 30+/mes. Overkill para nuestro tamaño.

- **Recomendación:** **A + B**. Cloud Logging para infra, Sentry para errores. Datadog cuando facturen >USD 10K/mes.

- **Pregunta para el jefe:** ¿USD 0–25/mes está OK para Sentry?

---

#### 2.13 Permisos por proyecto

- **Contexto.** Hoy 3 roles globales (`ADMIN`, `OPERACIONES`, `VIEWER`) en `User.role`. Si un usuario es `OPERACIONES`, puede escribir en CUALQUIER `Project`. Para 1 mall esto está bien. Para N malls es peligroso.

- **Opciones:**
  - **A) Status quo.** OK si seguimos en 1 mall.
  - **B) Tabla `ProjectMember(userId, projectId, role)`.** Cada usuario tiene rol por proyecto. Default: ADMIN ve todos, otros solo donde son miembros. Costo: bajo. Esfuerzo: **M** (~1 semana, mayoría es UI de admin).
  - **C) ABAC (atributos arbitrarios + policy engine).** Overkill.

- **Recomendación:** **B** si la decisión 2.6 es multi-tenant. **A** si BetaMallSport queda interno con 1 mall.

- **Pregunta para el jefe:** depende de 2.6.

---

## 3. Roadmap propuesto (3 escenarios)

### Conservador — "estabilizar lo que hay"
**Q2 (3 meses):** completar apply de los 5 uploads en P2 (decisión 2.1-A). Fix `.parse()` y pagination shape. Backups a GCS (2.8). Persistir Excels en GCS con retención 12m + checksum (2.4-C, 2.7-B). Sentry + alertas.
**Q3 (6 meses):** Cloud Tasks para job queue (2.2-B). Snapshot mensual congelado de rent roll (2.5-B selectivo).
**Q4 (12 meses):** refactor leaks Plan↔Real, mover reconciliación a su lib (2.9-B).

> **Entrega:** producto estable, reportabilidad histórica, sin sustos. Equipo: 1 dev. **Recomendado si BetaMallSport queda interno.**

### Balanceado — "estabilizar + abrir multi-tenant" *(recomendado si hay plan de vender)*
Igual que conservador hasta Q2. **Q3:** multi-tenant lógico (2.6-B) + permisos por proyecto (2.13-B). **Q4:** integración API piloto con sistema contable de un operador (2.1-B), si TI del operador acompaña.

> **Entrega:** plataforma vendible con aislamiento, integración real-time como diferencial. Equipo: 1 dev (apretado) o 2 devs (cómodo). **Recomendado si hay producto-mercado validado.**

### Agresivo — "refactor profundo"
Todo lo anterior + capa de dominio explícita (2.10), migración a tRPC (2.11), schema-per-tenant (2.6-C). 

> **Entrega:** arquitectura "perfecta". Costo: 12+ meses, alto riesgo de regresiones, sin features de negocio nuevas. **No recomendado** salvo equipo de 4+ devs y necesidad clara de escala.

---

## 4. Riesgos abiertos

| Riesgo | Probabilidad | Impacto | Mitigación | Dueño |
|---|---|---|---|---|
| 5 uploads Real (SALES, BANK, etc.) sin apply → operador no puede operar | Alta | Alto | Decisión 2.1-A; priorizar en Q2 | Felipe |
| Apply timeout (>60s) en archivo grande | Media | Medio | Decisión 2.2-B (Cloud Tasks) | Felipe |
| Cascade `AccountingRecord` borra GL al eliminar Unit/Project | Media | Crítico | Cambiar a `Restrict` en próxima migración | Felipe |
| Re-upload del mismo archivo crea duplicados | Alta | Medio | SHA-256 + idempotencia en DataUpload (decisión 2.4) | Felipe |
| Reportes auditables imposibles sin snapshots | Media | Alto cuando aparezca el directorio | Decisión 2.5-B selectivo | Felipe |
| Fuga de datos cross-project | Baja | Crítico | Auditoría queries `where: { projectId }` (5 spot-checks OK; auditar resto) | Felipe |
| Lock-in Neon | Baja | Medio | Backups a GCS (2.8-B) | Felipe |
| Ningún test en `contracts-apply-job/service` (~900 LOC) | Alta | Medio (regresiones silenciosas) | Cobertura mínima al refactorizar | Felipe |
| Decisión multi-tenant tardía si producto se vende | Media | Crítico | Cerrar 2.6 hoy | Jefe |

---

## 5. Próximos pasos post-reunión

**Semana 1 (5 días post-reunión):**
- [ ] Documentar decisiones 2.1, 2.4, 2.5, 2.6, 2.7, 2.13 como ADRs formales en `docs/architecture/adr/`
- [ ] Backups a GCS (2.8-B): cron diario operativo
- [ ] Fix `.parse()` → `.safeParse()` (deuda baja, fix de minutos)
- [ ] Cambiar cascade `AccountingRecord` a `Restrict`

**Semanas 2–6:**
- [ ] Apply para `SALES` + `BUDGETED_SALES` (P0)
- [ ] Apply para `ACCOUNTING` (cerrar mapping → DB)
- [ ] Persistir Excels en GCS + checksum
- [ ] Sentry integrado (frontend + backend)

**Semanas 7–12 (depende de 2.6):**
- Si **interno (A)**: Cloud Tasks (2.2-B), apply para `BANK` + `BALANCES`
- Si **vendible (B)**: prototipo `Tenant` + `ProjectMember` en branch separada

**Prototipos antes de comprometer:**
- Snapshot mensual congelado (decisión 2.5): branch + 1 mes de datos sintéticos antes de mergear
- Multi-tenant (decisión 2.6): proof-of-concept con 2 orgs ficticias antes de migrar prod

---

## Anexos

### A. File paths críticos (referencia rápida)

**Pipeline upload:**
- `src/lib/upload/parse-utils.ts:114-130` — file guards (5 MB, MIME)
- `src/lib/upload/parse-contracts.ts` — 1.425 LOC, tipo P0 más complejo
- `src/lib/upload/parse-{units,tenants}.ts` — P0 más estables
- `src/lib/upload/parse-{sales,accounting,balances,bank,budgeted-sales,expense-budget}.ts` — P2 sin apply
- `src/lib/plan/contracts-apply-{job,service}.ts` — apply RENT_ROLL
- `src/app/api/plan/upload/contracts/{preview,apply}/route.ts` — endpoints

**Schema:**
- `prisma/schema.prisma:276` — `Contract` (ver deprecaciones líneas 287, 296–297)
- `prisma/schema.prisma:339` — `ContractRate` (modelo bitemporal de referencia)
- `prisma/schema.prisma:475` — `DataUpload` (tabla de auditoría)
- `prisma/schema.prisma:559` — `AccountingRecord` (cascade peligroso 574–576)

**API:**
- `src/lib/permissions.ts` — `requireSession`, `requireWriteAccess`
- `src/lib/api-error.ts` — `handleApiError`
- `src/lib/pagination.ts` — `parsePaginationParams`
- `src/app/api/contracts/[id]/route.ts:307` — `.parse()` a corregir

**Mundos:**
- `src/lib/plan/{budget-vs-actual,metrics,rent-roll-snapshot}.ts` — leaks a `src/lib/real/billing-utils`
- `src/lib/real/reconciliation.ts` — debería estar en `src/lib/reconciliation/`
- `src/lib/navigation.ts:25-62` — top-nav 3 mundos

### B. Glosario del dominio

- **GLA (Gross Leasable Area):** m² arrendables del mall (excluye pasillos, estacionamientos).
- **Renta fija:** componente de arriendo en UF/m² por mes (independiente de ventas).
- **Renta variable:** componente que escala con ventas del arrendatario sobre umbrales (% sobre ventas).
- **GGCC (Gastos Comunes):** gastos operacionales del mall prorrateados (UF/m² + % administración).
- **Vacancia:** GLA sin contrato vigente / GLA total. Hoy modulada por flag `cuentaParaVacancia` por contrato.
- **WALT (Weighted Average Lease Term):** vencimiento promedio ponderado por GLA. Indicador de estabilidad contractual.
- **Plan / Expectativa:** lo que los contratos firmados dicen que se debe facturar.
- **Real / Realidad:** lo que efectivamente se facturó (datos contables del operador).
- **Reconciliación:** diferencia Plan vs Real, identificación de gaps.
- **Snapshot:** vista del rent roll a una fecha específica.
- **Bitemporalidad:** modelar tanto la fecha de vigencia (cuándo aplica el dato) como la fecha de transacción (cuándo se registró). Implementado en `ContractRate` vía `vigenciaDesde/Hasta` + `supersededAt`.
- **Apply:** segunda fase del upload — toma el preview validado y persiste en DB.
- **Preview:** primera fase del upload — parsea, valida, presenta cambios al usuario antes de persistir.

### C. Preguntas pendientes (NO se discuten hoy)

1. Migración a App Router server actions vs mantener `/api/*` REST — debate técnico, no urgente.
2. Internacionalización (i18n): hoy todo es es-CL. Si se vende fuera de Chile, replantear.
3. Audit log de cambios manuales (no por upload). Hoy `ContractAmendment` cubre contratos; otras entidades no.
4. ¿Quién puede aprobar overrides de validación (ej. cargar archivo con errores)?
5. Política de retención de logs (Cloud Logging tiene 30 días default; ¿exportar a GCS?).
6. SSO con Google Workspace del operador (vs nuestro propio whitelist) — depende de 2.6.
7. Performance budget: ¿cuál es el SLA para rent roll snapshot (<2s)? Hoy no está medido.
8. Política de migrations en producción: ¿downtime aceptable? Migraciones sobre 1M de filas en `AccountingRecord` pueden tardar.

---

*Fin del reporte. Versión 1.0 — borrador para revisión 1-a-1.*
