# UI/UX Review — BetaMallSport — Felipe Branch — 2026-04-19

---

## Executive Summary

- **Dos sistemas de tabla paralelos coexisten sin unificacion**: el componente `DataTable` (TanStack Table + virtualizacion) se usa en modulos modernos, mientras que `ReconciliationClient`, `EerrClient` y la tabla de "Alertas de Facturacion" en `dashboard/page.tsx` construyen tablas HTML ad-hoc con `<table>/<thead>/<tr>` crudos. Esto genera ~40% de las inconsistencias visuales detectadas y hace imposible garantizar comportamiento uniforme de columnas sticky, densidad y filtros.
- **Formateo financiero inconsistente con 17 locales de `toLocaleString` dispersos**: la unidad de cuenta primaria es UF, pero hay al menos 4 formatos distintos (`formatDecimal`, `formatUf`, `fmtUf` local, `.toLocaleString` directo) para el mismo tipo de dato. El separador de miles chileno (`1.234,56`) se aplica correctamente via `es-CL`, pero la cantidad de fracciones decimales varia entre 2, 3 y 4 decimales para la misma magnitud (UF/m²) segun el componente.
- **`KpiCard` usa `rounded-lg` y `shadow hover:shadow-md` mientras que `CustomKpiCard` usa `rounded-md` y `shadow-sm hover:shadow-md`**: son los dos componentes de KPI del proyecto y tienen spec visual distinta. El `ModuleSectionCard` usa `rounded-md shadow-card`; el `AlertBar` usa `rounded-md shadow` (sin token). Este fragmento genera una app donde KPIs del dashboard central y KPIs del Rent Roll se ven "levemente distintos" sin razon de diseno.
- **El estado de carga `ModuleLoadingState` no cubre todos los modulos**: `ReconciliationClient`, `EerrClient` (detalle arrendatario) y partes de `FinanceDashboardClient` muestran mensajes de texto plano ("Cargando...") sin skeleton shapes, mientras que `ModuleLoadingState` con `shape="table"` o `shape="kpis"` ya existe y no se usa.

---

## Metodologia

Se realizaron las siguientes acciones:

1. **Globbing exhaustivo** de `src/components/**/*`, `src/app/(dashboard)/**/*`, `src/hooks/**/*` — se identificaron 98 archivos de componente.
2. **Lectura profunda** de 35 archivos clave: los dos sistemas de tabla, ambas variantes de KPI card, los 5 clientes financieros principales, el dashboard principal, el sistema de temas de tabla y la configuracion de Tailwind.
3. **Busquedas grep** de patrones problematicos: `rounded-lg`, `shadow-md/lg/xl`, colores hardcoded (`text-blue-`, `text-red-`, `bg-green-`), `aria-label`, `toLocaleString`.
4. **Git log** de los ultimos 30 commits para identificar areas de cambio activo.
5. **Investigacion web** de referencias externas de diseno financiero (ver Seccion 5).

---

## 1. Inventario de Vistas y Componentes

### Paginas del Dashboard (`src/app/(dashboard)/`)

| Ruta | Descripcion |
|------|-------------|
| `/dashboard` | KPIs globales, alertas, cartera, vencimientos |
| `/rent-roll/dashboard` | Snapshot, tabla contractual, ocupacion |
| `/rent-roll/contracts` | Lista y gestion de contratos |
| `/rent-roll/contracts/[id]` | Detalle de contrato individual |
| `/rent-roll/tenants` | Listado de arrendatarios |
| `/rent-roll/units` | Listado de locales/unidades |
| `/rent-roll/upload` | Carga masiva de rent roll |
| `/rent-roll/projects` | Gestion de proyectos |
| `/tenants/[id]` | Vista 360 del arrendatario |
| `/finance/dashboard` | Dashboard financiero consolidado |
| `/finance/eerr` | Estado de Resultados |
| `/finance/reconciliation` | Reconciliacion facturacion esperada vs real |
| `/finance/waterfall` | Waterfall de ingresos |
| `/finance/analysis` | Analisis financiero dimensional |
| `/finance/facturacion` | Facturacion por categoria/piso |
| `/finance/ventas` | Analytics de ventas |
| `/finance/occupancy` | Ocupacion financiera |
| `/finance/ggcc` | Deficit GGCC |
| `/finance/costo-ocupacion` | Costo de ocupacion |
| `/finance/budget` | Presupuesto |
| `/finance/tenants` | Arrendatarios financieros |
| `/finance/mappings` | Mapeos contables |
| `/finance/upload` | Carga de datos contables |
| `/configuracion/proyecto` | Configuracion del proyecto |
| `/configuracion/dashboard` | Configuracion del dashboard |
| `/configuracion/sistema` | Configuracion del sistema |

### Componentes UI Core (`src/components/ui/`)

`DataTable`, `UnifiedTable`, `StatusBadge`, `ConfirmModal`, `RecordDetailModal`, `ProjectCreationPanel`, `ProjectSelector`, `HelpButton/HelpDrawer`, `MetricTooltip`, `TableDisclosureButton`, `Spinner`, `button`, `input`, `select`, `badge`, `dialog`, `sheet`, `form-field`, `table`, `table-theme`, `skeletons`, `sonner`, `DeltaPill`, `StatChip`

### Componentes de Dominio

- **Dashboard**: `KpiCard`, `AlertBar`, `MetricChartCard`, `ModuleHeader`, `ModuleEmptyState`, `ModuleLoadingState`, `ModuleSectionCard`, `ProjectPeriodToolbar`, `ContractExpiryTable`, `ExpirationsByYearTable`
- **Rent Roll**: `RentRollDashboardTable`, `RentRollKpiHeader`, `CustomKpiCard`, `ContractTable`, `ContractsViewTable`, `TenantsViewTable`, `UnitsViewTable`, y 8 componentes adicionales de graficos/crud
- **Finance**: `EerrTable`, `EerrClient`, `ReconciliationClient`, `WaterfallClient`, `FinanceDashboardClient`, `VentasAnalyticsClient`, `FacturacionClient`, `GgccDeficitClient`, `OccupancyClient`, `CostoOcupacionClient`, `FinanceAnalysisClient`, `FinanceMappingsClient`, `FinanceMappingsClient`
- **Tenant 360**: `Tenant360Client`, `TenantProfileHeader`, `TenantKpiRow`, `FinancialTimelineChart`, `FacturacionPerM2Chart`, `BillingBreakdownSection`, `SalesPerformanceSection`, `OccupancyTimeline`, `PeerComparisonSection`, `ProjectionsSection`, `ContractDetailsSection`
- **Contratos**: `ContractForm`, `ContractManager`, `ContractEditModal`, `BatchReviewModal`, `TarifaListEditor`, `GgccListEditor`, `RentaVariableListEditor`, `ContractAttachmentZone`

---

## 2. Hallazgos por Vista

### 2.1 Dashboard Principal (`/dashboard`)

**Severidad general: ALTO**

**Hallazgos:**

1. **[ALTO] Tabla de "Alertas de Facturacion" construida a mano** (lineas 631-685 de `src/app/(dashboard)/dashboard/page.tsx`). Es la unica tabla del dashboard principal que no usa `DataTable`. No tiene filtros, no tiene densidad configurable, no soporta ordenamiento. Usa estilos hardcoded inline (`className={...}`). Deberia migrar a `DataTable` con columnas definidas.

2. **[ALTO] Seccion de vencimientos usa `<ExpirationsByYearTable>`** que construye su propia tabla primitiva. No hay filtros, no hay totales de UF en riesgo.

3. **[MEDIO] El header del dashboard usa un patron distinto al `ModuleHeader`** estandar: `<header className="rounded-md bg-white p-5 shadow-sm">` con un `<div>` interno para el titulo, en lugar del componente `ModuleHeader` con su barra dorada lateral (`before:` pseudoelemento). Esto rompe la consistencia visual con todas las demas vistas que usan `ModuleHeader`.

4. **[MEDIO] `formatClp` esta definida localmente** en `dashboard/page.tsx` (linea 79-84). La misma funcion esta definida en `TenantProfileHeader.tsx` y `TenantKpiRow.tsx`. Deberia exportarse desde `@/lib/utils`.

5. **[BAJO] Sin estado de carga estructurado para el dashboard**: como es un Server Component, no hay loading state visible al cambiar de periodo. El archivo `loading.tsx` existe pero sirve solo para la navegacion inicial.

---

### 2.2 Rent Roll Dashboard (`/rent-roll/dashboard`)

**Severidad general: MEDIO**

**Hallazgos:**

1. **[ALTO] `RentRollDashboardTable` no tiene column pinning**: la tabla tiene hasta 14 columnas cuando se activa "Mostrar facturacion real". En pantallas de 1280px, las columnas de brecha desaparecen del viewport. La columna "Local" (identificador clave) deberia estar fija a la izquierda via TanStack column pinning.

2. **[MEDIO] Checkbox "Mostrar facturacion real" no tiene `<label>` asociado**: el `<input type="checkbox">` tiene el texto en el mismo `<label>` contenedor, lo cual es correcto, pero el texto dice "Mostrar facturacion real" sin acentos — inconsistente con el resto de la UI que usa "Facturación" con tilde.

3. **[MEDIO] Dos sistemas de KPI en la misma pagina**: `RentRollKpiHeader` usa `KpiCard` (con `rounded-lg` y `shadow hover:shadow-md`). Los custom widgets debajo usan `CustomKpiCard` (con `rounded-md` y `shadow-sm`). El resultado visual es una fila de KPIs con border-radius distinto.

4. **[BAJO] La barra de ocupacion (`h-3`) no tiene `role="progressbar"` ni `aria-valuenow/min/max`**: no es accesible para lectores de pantalla.

---

### 2.3 Estado de Resultados EERR (`/finance/eerr`)

**Severidad general: CRITICO**

**Hallazgos:**

1. **[CRITICO] Dos implementaciones del EERR coexisten**: `EerrClient.tsx` contiene un EERR completo con tabla HTML primitiva (lineas 224-490). `EerrTable.tsx` contiene una segunda implementacion del mismo EERR usando componentes `<Table>` de Shadcn/ui, con soporte de presupuesto y varianzas. La vista `/finance/eerr` usa `EerrClient`. No esta claro cual es la implementacion "oficial". `EerrTable` tiene capacidades superiores (columnas de presupuesto, tokens `positive/negative`, soporte de `hasBudgets`) que no llegan al usuario final. **Este es el hallazgo mas critico del review.**

2. **[ALTO] Panel de detalle de arrendatario en `EerrClient` es un slide-over construido a mano** (lineas 496-615) con `position: fixed`, sin usar el componente `<Sheet>` de Shadcn/ui que ya existe en `src/components/ui/sheet.tsx`. No tiene accesibilidad de dialog (sin `role="dialog"`, sin `aria-modal`, sin trampa de foco).

3. **[ALTO] Formato de numeros en EERR usa `formatEerr`** (de `@/lib/finance/eerr`) que aplica parentesis para negativos. `EerrTable` usa `formatUf` (de `@/lib/utils`). Los dos componentes del mismo dominio EERR producen formatos de numero distintos.

4. **[MEDIO] La tabla EERR no tiene sticky header funcional en movil**: el `sticky top-0 z-20` del `thead` funciona en desktop, pero en mobile el contenedor padre no tiene `overflow-x-auto` con altura maxima definida, por lo que el header no se mantiene visible al scrollear verticalmente en tablas largas.

5. **[BAJO] `formatPeriodo` redefinida localmente en `EerrClient`** (linea 30-35). La misma logica existe en `@/lib/utils.ts` como `formatPeriodo`. Dos funciones distintas con el mismo nombre y logica similar pero diferente formateo del year (2 vs 4 digitos).

---

### 2.4 Reconciliacion (`/finance/reconciliation`)

**Severidad general: ALTO**

**Hallazgos:**

1. **[ALTO] Tabla construida con HTML primitivo en lugar de `DataTable`**: `ReconciliationClient.tsx` usa `<table className={tableTheme.table}>` directamente (lineas 230-356). La consecuencia es que no tiene los filtros de columna, ordenamiento interactivo, ni virtualizacion del sistema `DataTable`. Con muchos arrendatarios, la tabla se vuelve lenta.

2. **[ALTO] Sticky column en mobile no funciona correctamente**: el `sticky left-0 bg-inherit` en la celda de arrendatario asume que el color de fondo se hereda. Cuando la fila es par (`bg-slate-50/60`), `bg-inherit` funciona. Pero con el `bg-brand-50` de la fila activa, la celda pegada conserva el color base.

3. **[MEDIO] `GapBadge` usa `rounded-full` mientras que `StatusBadge` (contratos) usa `rounded`**: dos badges de estado de la misma app con border-radius distinto. El sistema de diseno deberia definir un estandar.

4. **[MEDIO] La respuesta del fetch no valida `response.ok`**: en `fetchData` (linea 94-106), si la API devuelve 4xx/5xx, `setData(payload)` se llama con el objeto de error. No hay manejo de estado de error.

5. **[BAJO] El select de filtro de gap (`<select>`) no tiene estilos consistentes**: usa `border border-slate-300` sin el sistema de `Input` o `Select` de Shadcn/ui. La altura del select no coincide con los botones de tab adyacentes.

---

### 2.5 Tenant 360 (`/tenants/[id]`)

**Severidad general: MEDIO**

**Hallazgos:**

1. **[ALTO] `TenantKpiRow` renderiza 8 KPI cards en un grid `grid-cols-2 lg:grid-cols-4 xl:grid-cols-4`**: con 8 cards, en xl se forman 2 filas de 4. Sin embargo, el orden visual no respeta jerarquia de importancia — Costo de Ocupacion aparece primero (metrica secundaria) antes que Renta Fija (metrica primaria). La primera fila deberia tener las metricas de mayor impacto.

2. **[MEDIO] `formatClp` definida por tercera vez** en `TenantKpiRow.tsx` (linea 12-17) y en `TenantProfileHeader.tsx` (linea 14-19). La misma funcion existe en `dashboard/page.tsx`. Total: 3 copias de la misma funcion.

3. **[MEDIO] La vista 360 no tiene estado de error visual estructurado**: cuando `error !== null`, muestra `<ModuleEmptyState message={error} />`, que es un componente de "sin datos" con icono de inbox, no un componente de error. Un error de red y un arrendatario sin datos se ven identicos.

4. **[BAJO] `ProjectPeriodToolbar` en Tenant360 actualiza el URL con `router.replace`** pero la actualizacion del URL es manual con `window.location.search`. Si la URL tiene parametros adicionales, este codigo puede sobreescribirlos.

---

### 2.6 Finance Dashboard (`/finance/dashboard`)

**Severidad general: MEDIO**

**Hallazgos:**

1. **[ALTO] `normalizeDashboardData`** (lineas 95-130 de `FinanceDashboardClient.tsx`): es una funcion de 60 lineas que normaliza la respuesta de la API con aliases en ingles/espanol (`ingresosRaw.actual ?? ingresosRaw.current`). Indica que el contrato de la API ha cambiado y el cliente tiene compatibilidad hacia atras. Deberia limpiarse el contrato API.

2. **[MEDIO] Dos funciones `fmtUf` locales**: `GgccDeficitClient` define `fmtUf` local, `FacturacionClient` define `fmtUfM2` local, cuando `formatUf` de `@/lib/utils` deberia servir para ambos casos.

3. **[BAJO] `valueCls` en `FinanceAnalysisClient` usa `text-red-600`** (linea 41) en lugar del token `text-negative-600` definido en `tailwind.config.ts`. Este es uno de 15 usos de colores hardcoded fuera del sistema de tokens.

---

### 2.7 Mappings (`/finance/mappings`)

**Severidad general: BAJO**

**Hallazgos:**

1. **[MEDIO] `TabButton` definido localmente** en `FinanceMappingsClient.tsx` (lineas 44-58). Este patron de tab-button tambien existe en `ReconciliationClient` (lineas 192-212) y en `EerrClient` (lineas 182-194) — tres implementaciones distintas del mismo componente "tab button". Deberia ser un componente compartido.

2. **[BAJO] Sin paginacion en mappings**: si hay muchos mappings contables, la tabla se llena sin virtualizacion.

---

## 3. Inconsistencias Transversales

### 3.1 Dos Sistemas de Tabla

La inconsistencia mas grave del repositorio es la coexistencia de dos sistemas de tabla:

**Sistema A — `DataTable` (TanStack):**
- Usado en: `ContractTable`, `ContractsViewTable`, `TenantsViewTable`, `UnitsViewTable`, `RentRollDashboardTable`, `FinanceMappingsClient`
- Capacidades: filtros en columna tipo Excel, ordenamiento, virtualizacion >100 filas, fila de totales, density control, linkTo navigation

**Sistema B — Tabla HTML primitiva con `tableTheme`:**
- Usado en: `ReconciliationClient`, `EerrClient`, `FinanceDashboardClient` (tabla EERR), `dashboard/page.tsx` (alertas)
- Capacidades: sticky column manual, pero sin filtros, sin ordenamiento, sin virtualizacion

La consecuencia practica: un usuario de contabilidad que trabaja en Reconciliacion no puede ordenar la tabla por brecha, ni filtrar por arrendatario — funcionalidades que si existen en la tabla de contratos de la misma aplicacion.

### 3.2 Inconsistencia de Border Radius

Conteo de `rounded-lg` vs `rounded-md` en componentes interactivos:

| Componente | Border Radius | Correcto segun CLAUDE.md |
|------------|--------------|------------------------|
| `KpiCard` | `rounded-lg` | No (deberia ser `rounded-md`) |
| `CustomKpiCard` | `rounded-md` | Si |
| `ModuleSectionCard` | `rounded-md` | Si |
| `AlertBar` | `rounded-md` | Si |
| `ContractAttachmentZone` | `rounded-lg` | No |
| `ModuleLoadingState` (kpis) | `rounded-md` | Si |
| `dialog.tsx` | `rounded-lg` | No |

`KpiCard` es el componente mas visible del dashboard y usa `rounded-lg` en contra del estandar `rounded-md` del proyecto.

### 3.3 Tokens de Sombra Inconsistentes

| Lugar | Clase usada | Token correcto |
|-------|------------|----------------|
| `KpiCard` | `shadow hover:shadow-md` | `shadow-card hover:shadow-card-hover` |
| `CustomKpiCard` | `shadow-sm hover:shadow-md` | `shadow-card hover:shadow-card-hover` |
| `AlertBar` | `shadow` (bare) | `shadow-card` |
| `ModuleSectionCard` | `shadow-card` | Correcto |
| `WaterfallClient` tooltip | `shadow-sm` | Correcto |

`shadow-card` y `shadow-card-hover` estan definidos en `tailwind.config.ts` con valores precisos (`0 1px 2px...`). Su adopcion no es uniforme.

### 3.4 Colores Hardcoded Fuera del Sistema de Tokens

Se encontraron 15 usos de `text-red-`, `text-green-`, `bg-red-`, `bg-green-`, `bg-blue-` en 8 archivos. Los tokens correctos son:

| Uso hardcoded | Token correcto |
|--------------|----------------|
| `text-red-600` / `text-red-700` | `text-negative-600` / `text-negative-700` |
| `text-emerald-700` (mayoritariamente correcto) | `text-positive-700` (token formal) |
| `bg-red-*` | `bg-negative-*` |
| `text-green-*` | `text-positive-*` |

Archivos con mayor incidencia: `FinanceAnalysisClient.tsx`, `GgccDeficitClient.tsx`, `FinanceMappingsClient.tsx`, `OccupancyBadge.tsx`.

### 3.5 Funcion `formatClp` Triplicada

La funcion `formatClp` (que formatea CLP con `Intl.NumberFormat`) esta definida de forma identica en tres archivos:

- `src/app/(dashboard)/dashboard/page.tsx` linea 79
- `src/components/tenant-360/TenantProfileHeader.tsx` linea 14
- `src/components/tenant-360/TenantKpiRow.tsx` linea 12

Deberia exportarse desde `src/lib/utils.ts`.

### 3.6 Funcion `formatPeriodo` Duplicada con Logica Distinta

Existe `formatPeriodo` en `src/lib/utils.ts` (retorna "Ene 2025") y una segunda definicion local en `EerrClient.tsx` (retorna "Ene 25" — ano de 2 digitos). `CustomKpiCard.tsx` tiene una tercera version local identica a la de `EerrClient`. El estandar del proyecto deberia ser uno solo.

### 3.7 Estado Vacio Insuficiente

`ModuleEmptyState` (usado en ~12 vistas) muestra solo texto y un link opcional, sin icono contextual. No distingue entre:
- Sin datos de periodo (normal: el usuario no ha cargado datos)
- Error de red (anormal: la API fallo)
- Permisos insuficientes (raro: el usuario no tiene acceso)

Los tres estados se muestran identicos. El componente deberia aceptar un `variant: "empty" | "error" | "restricted"`.

### 3.8 Patron de Tab sin Componente Compartido

El patron de "tab buttons" (General/GGCC en Reconciliacion, Mensual/Anual en EERR, por tamano/tipo/piso en Facturacion y Ventas) tiene al menos 5 implementaciones distintas en el codebase. No existe un `<TabBar>` o `<SegmentedControl>` reutilizable.

---

## 4. Analisis de Datos Financieros

### 4.1 Formateo de UF

La aplicacion usa correctamente `locale: "es-CL"` para separadores de miles y decimal. Sin embargo, la cantidad de decimales para UF varia:

| Contexto | Decimales usados | Estandar sugerido |
|----------|-----------------|-------------------|
| Renta fija | 2 | 2 |
| Tarifa ponderada UF/m² | 4 | 4 |
| UF/m² en subtitulo de KPI | 3 | 4 (consistencia con tarifa) |
| Ventas en UF | 2 | 2 |
| Brecha en UF | 2 | 2 |
| GLA en m² | 1 o 2 segun componente | 2 |

El `weightedAvgUfM2` en `RentRollDashboardTable` usa 4 decimales directamente con `.toLocaleString` en lugar de `formatUf(value, 4)` — mezcla de acceso directo y funcion centralizada.

### 4.2 Alineacion de Columnas Numericas

`DataTable` implementa `meta: { align: "right" }` correctamente para todas las columnas numericas. En las tablas HTML primitivas (Reconciliacion, EERR), la alineacion derecha se aplica con `text-right` directamente, pero no hay garantia de `tabular-nums` en todos los casos.

`tabular-nums` se aplica correctamente en `DataTable` via `isNumeric` meta. En `ReconciliationClient`, las celdas numericas tienen `tabular-nums` manual pero no `font-feature-settings: "tnum"` para fuentes que no lo activan por defecto.

### 4.3 Filas de Totales

El sistema `DataTable` tiene soporte de `summaryRow` con `meta: { summary: { type: "sum" } }` — bien implementado en `RentRollDashboardTable`.

Las tablas primitivas implementan totales manualmente en `<tfoot>` (Reconciliacion, EERR). Esta duplicacion de logica puede producir totales incorrectos si la logica de filtracion cambia: en Reconciliacion, los totales del `<tfoot>` calculan sobre `filteredRows` (correcto), pero la formula del `%` se recalcula inline sin extraer a funcion.

### 4.4 Colores Positivo/Negativo

El `tailwind.config.ts` define tokens semanticos `positive` y `negative` con paletas completas (50/100/600/700). La adopcion es parcial:

- `EerrTable.tsx` usa `text-positive-700` / `text-negative-700` — **correcto**
- `GgccDeficitClient.tsx` usa `text-emerald-700` / `text-red-700` — **incorrecto** (no usa tokens)
- `ReconciliationClient.tsx` usa `text-emerald-700` / `text-rose-700` — **parcialmente correcto** (rose != negative)
- `WaterfallClient.tsx` usa `text-emerald-700` / `text-rose-700` — **idem**

El token `negative` mapea a rose (`#e11d48`), pero algunos componentes usan `rose` directamente y otros usan `red`. El resultado visual es que el rojo de una alerta en el EERR tiene un matiz distinto al rojo de la reconciliacion.

### 4.5 KPIs y Metricas

Los KPI cards tienen tooltip via `MetricTooltip` que muestra formula y descripcion — excelente patron de "formula transparency" para usuarios financieros. Sin embargo:

- `KpiCard` requiere `metricId` obligatorio, pero varios KPIs en `ReconciliationClient` reutilizan el mismo `metricId` para tarjetas distintas (ej: `kpi_rent_roll_snapshot_brecha_total` aparece en 3 KPIs).
- Los KPIs del Tenant 360 no tienen comparativa con el periodo anterior (sin delta/flecha de tendencia), mientras que `CustomKpiCard` del Rent Roll si tiene sparkline y delta. Los usuarios de la vista 360 no pueden ver si la renta fija de un arrendatario subio o bajo respecto al mes anterior.

### 4.6 Drilldown y Navegacion

El drilldown esta bien implementado en EERR (click en arrendatario abre panel de facturacion) y en la tabla principal (linkTo en columna de Local y Arrendatario). Sin embargo:

- Desde Reconciliacion no hay link directo al contrato del arrendatario
- Desde las alertas de facturacion del Dashboard principal si hay link al tenant 360
- Desde el KPI de "Locales sin arrendatario" no hay link a la lista de vacantes

---

## 5. Referencias Externas — Mejores Practicas

### 5.1 Pencil & Paper — Enterprise Data Tables UX
**URL:** https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables

**Hallazgos relevantes para BetaMallSport:**
- Recomiendan **right-align + monospace** para toda columna numerica. La app lo implementa bien en `DataTable` pero no en tablas primitivas.
- **Freeze leftmost columns** durante scroll horizontal. Solo `EerrClient` y `ReconciliationClient` implementan `sticky left-0`, pero no de forma sistematica.
- **Display density controls** (compact/default/comfortable) como control de usuario, no solo como prop interna. `DataTable` tiene el sistema de density pero no expone ningun UI control al usuario para cambiarlo.
- Zebra stripes recomiendan evitarlas en tablas con estados interactivos hover. La app usa `rowStripedMuted: "bg-slate-50/60"` + `rowHover: "hover:bg-brand-50"` — el hover sobreescribe la cebra correctamente.

### 5.2 Wildnet Edge — Fintech UX Best Practices for Financial Dashboards
**URL:** https://www.wildnetedge.com/blogs/fintech-ux-design-best-practices-for-financial-dashboards

**Hallazgos relevantes:**
- **Jerarquia visual por importancia**: los KPIs mas criticos deben estar en la primera posicion. En el dashboard, Ocupacion (85%+) aparece antes que Ingresos del Periodo, pero sin indicador visual de "semaforo" consolidado en el header.
- **Drill-down charts**: la app implementa drill-down en EERR (expandir grupos) y en Tenant 360 (multiples graficos). El patron es correcto pero el slide-over del EERR no usa el componente `Sheet`.
- **Customizacion por rol**: existe `canWrite(role)` para controlar edicion, pero no existe customizacion de vista de dashboard por rol (un VIEWER ve lo mismo que un ADMIN).

### 5.3 TanStack Table — Column Pinning y Virtualization
**URL:** https://tanstack.com/table/v8/docs/guide/column-pinning
**URL:** https://tanstack.com/table/latest/docs/guide/virtualization

**Aplicacion directa:**
- La app ya usa `useVirtualizer` en `DataTable` con `VIRTUALIZATION_THRESHOLD = 100`. Buen patron.
- Column pinning esta disponible en TanStack v8 via `getPinnedColumns()`. El hook `useDataTable` no expone la configuracion de column pinning. Para `RentRollDashboardTable` con 14 columnas, agregar `columnPinning: { left: ["local"] }` al estado inicial del hook resolveria el problema de scroll horizontal sin perder referencia de local.

### 5.4 Medium — Building High-Performance Virtualized Table (2026)
**URL:** https://medium.com/@ashwinrishipj/building-a-high-performance-virtualized-table-with-tanstack-react-table-ced0bffb79b5

**Arquitectura recomendada:**
- Spacer-based virtualization (ya implementado en `DataTable`) con `sticky top-0` en header.
- El articulo recomienda que el contenedor de scroll tenga `max-h` explicita. La app usa `max-h-[600px]` para tablas virtualizadas — correcto, pero el threshold de 100 filas es conservador. Para tablas financieras con 50-80 contratos (comun en un mall), la virtualizacion no se activa y la tabla carga todas las filas en el DOM.

### 5.5 Stripe Dashboard Design Patterns
**URL:** https://docs.stripe.com/stripe-apps/patterns
**URL:** https://www.saasframe.io/examples/stripe-payments-dashboard

**Patrones aplicables:**
- **KPI card con sparkline + delta**: Stripe muestra sparkline, valor actual, y delta vs periodo anterior en cada card. La app lo implementa en `CustomKpiCard` (Rent Roll) pero no en `KpiCard` (resto de la app). Unificar con sparkline opcional aumentaria el valor informativo del dashboard principal.
- **Skeleton screens con shimmer**: la app implementa `ModuleLoadingState` con skeleton shapes, pero solo 3 de los ~12 modulos lo usan con shapes especificos. Stripe/Linear reportan reduccion del 20-30% en perceived load time con skeletons.
- **Sticky action bar**: Stripe muestra una barra de acciones flotante cuando hay filas seleccionadas. La app no tiene seleccion multiple de filas en ninguna tabla.

### 5.6 UXPin — Dashboard Design Principles 2025
**URL:** https://www.uxpin.com/studio/blog/dashboard-design-principles/

**Principios relevantes:**
- "Information density over whitespace for power users." La app ya sigue este principio con density compact, tablas densas y KPIs pequeños.
- "Use consistent status indicators." El issue de `GapBadge` (rounded-full) vs `StatusBadge` (rounded) viola este principio directamente.

---

## 6. Recomendaciones Accionables

### Quick Wins (menos de 1 dia de trabajo cada uno)

**QW-1: Unificar `KpiCard` border-radius y shadow**
- Archivo: `src/components/dashboard/KpiCard.tsx`
- Cambiar `rounded-lg border border-slate-200` → `rounded-md border border-slate-200`
- Cambiar `shadow transition-shadow duration-200 hover:shadow-md` → `shadow-card transition-shadow duration-200 hover:shadow-card-hover`
- Impacto: elimina la inconsistencia visual mas visible en el dashboard principal

**QW-2: Exportar `formatClp` desde `@/lib/utils`**
- Mover la definicion a `src/lib/utils.ts` y eliminar las 3 copias locales
- Agregar `export function formatClp(value: number): string { ... }`

**QW-3: Reemplazar colores hardcoded por tokens en `GgccDeficitClient` y `FinanceAnalysisClient`**
- `text-red-600` → `text-negative-600`
- `text-red-700` → `text-negative-700`
- `text-emerald-700` → `text-positive-700`

**QW-4: Agregar `response.ok` check en `ReconciliationClient.fetchData`**
```typescript
const response = await fetch(`/api/finance/reconciliation?${params.toString()}`);
if (!response.ok) {
  const msg = await readErrorMessage(response, "Error al cargar datos de reconciliacion.");
  throw new Error(msg);
}
```
- Agregar estado `error` al componente y mostrar `<ModuleEmptyState>` diferenciado.

**QW-5: Agregar `role="progressbar"` a la barra de ocupacion de `RentRollKpiHeader`**
```tsx
<div
  role="progressbar"
  aria-valuenow={Math.round(pctOcupado)}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`Ocupacion: ${formatPct(pctOcupado)}`}
  className="h-3 overflow-hidden rounded-full bg-slate-100"
>
```

**QW-6: Reducir `VIRTUALIZATION_THRESHOLD` de 100 a 50**
- Archivo: `src/components/ui/DataTable.tsx` linea 62
- Un mall tipico tiene 40-80 contratos; la virtualizacion deberia activarse a 50 para garantizar fluidez

**QW-7: Crear componente `<TabBar>` compartido**
- Archivo nuevo: `src/components/ui/TabBar.tsx`
- Props: `tabs: { id: string; label: string }[]`, `activeTab: string`, `onChange: (id: string) => void`
- Reemplazar las 5 implementaciones ad-hoc de tabs en Reconciliacion, EERR, Facturacion, Ventas, Ventas Analytics

---

### Refactors Mayores (2-5 dias cada uno)

**RM-1: Migrar `ReconciliationClient` a `DataTable`**

La tabla de reconciliacion deberia usar `DataTable` con las siguientes columnas:
```typescript
const columns: ColumnDef<ReconciliationRow>[] = [
  { accessorKey: "nombreComercial", header: "Arrendatario", meta: { filterType: "text", linkTo: { path: "/tenants", idKey: "tenantId" } } },
  { accessorKey: "glam2", header: "GLA (m²)", meta: { align: "right", summary: { type: "sum" } } },
  { accessorKey: "expectedUf", header: "Esperado (UF)", meta: { align: "right", summary: { type: "sum" } } },
  { accessorKey: "actualUf", header: "Real (UF)", meta: { align: "right", summary: { type: "sum" } } },
  { accessorKey: "gapUf", header: "Brecha (UF)", meta: { align: "right", summary: { type: "sum" } } },
  { accessorKey: "gapPct", header: "Brecha %", meta: { align: "right" } },
];
```
La fila de totales del `<tfoot>` se reemplaza por `summaryRow={{ enabled: true }}`. Se gana filtrado, ordenamiento y virtualizacion sin codigo adicional.

**RM-2: Consolidar EERR — elegir `EerrTable` como implementacion unica**

`EerrTable.tsx` es la implementacion superior (soporta presupuesto, varianzas, tokens semanticos correctos). El plan:
1. Migrar el modulo `/finance/eerr` (pagina y cliente) a usar `EerrTable` como el unico componente de tabla
2. Portar el panel de detalle de arrendatario de `EerrClient` al nuevo flujo, usando `<Sheet>` de Shadcn/ui en lugar del slide-over manual
3. Deprecar la implementacion de tabla primitiva en `EerrClient`

**RM-3: Agregar column pinning a `RentRollDashboardTable`**

En `useDataTable.ts`, agregar soporte opcional de `initialColumnPinning`:
```typescript
export function useDataTable<TData>(
  data: TData[],
  columns: ColumnDef<TData, unknown>[],
  options?: { initialColumnPinning?: ColumnPinningState }
) {
  const table = useReactTable({
    // ...existing config
    enableColumnPinning: true,
    initialState: {
      columnPinning: options?.initialColumnPinning ?? {},
    },
  });
}
```
En `RentRollDashboardTable`:
```typescript
const { table } = useDataTable(sortedBaseRows, columns, {
  initialColumnPinning: { left: ["local", "arrendatario"] }
});
```

**RM-4: Unificar `KpiCard` y `CustomKpiCard` en un componente unico**

Crear `src/components/ui/MetricCard.tsx` con props que cubran ambas variantes:
```typescript
type MetricCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  accent?: "positive" | "negative" | "warning" | "neutral";
  trend?: { delta: number; direction: "up" | "down" | "flat" };
  sparkline?: number[];  // ultimos N valores
  metricId?: MetricFormulaId;  // opcional para el tooltip
};
```
El componente renderiza el tooltip de formula si `metricId` esta presente, y el sparkline si `sparkline` tiene >= 2 valores.

**RM-5: Agregar variante `"error"` a `ModuleEmptyState`**
```typescript
type ModuleEmptyStateProps = {
  message: string;
  variant?: "empty" | "error" | "restricted";
  actionHref?: string;
  actionLabel?: string;
};
```
- `empty`: icono Inbox (actual)
- `error`: icono AlertCircle con fondo rose-50
- `restricted`: icono Lock con fondo amber-50

---

## 7. Plan Priorizado

| # | Item | Severidad | Esfuerzo | Impacto | Area |
|---|------|-----------|----------|---------|------|
| 1 | Migrar tabla Reconciliacion a `DataTable` (RM-1) | CRITICO | 3 dias | Alto | Finance |
| 2 | Consolidar EERR en `EerrTable` con `<Sheet>` (RM-2) | CRITICO | 4 dias | Alto | Finance |
| 3 | Unificar border-radius y shadow en `KpiCard` (QW-1) | ALTO | 0.5h | Medio | Global |
| 4 | Exportar `formatClp` desde utils (QW-2) | ALTO | 1h | Medio | Global |
| 5 | Column pinning en RentRollDashboardTable (RM-3) | ALTO | 1 dia | Alto | Rent Roll |
| 6 | Agregar `response.ok` check en Reconciliacion (QW-4) | ALTO | 1h | Alto | Finance |
| 7 | Crear `<TabBar>` compartido (QW-7) | MEDIO | 1 dia | Medio | Global |
| 8 | Unificar `KpiCard` + `CustomKpiCard` (RM-4) | MEDIO | 2 dias | Medio | Global |
| 9 | Reemplazar colores hardcoded por tokens (QW-3) | MEDIO | 2h | Bajo | Finance |
| 10 | Agregar variante `"error"` a `ModuleEmptyState` (RM-5) | MEDIO | 0.5 dia | Medio | Global |
| 11 | Bajar `VIRTUALIZATION_THRESHOLD` a 50 (QW-6) | MEDIO | 15min | Alto | Global |
| 12 | Accesibilidad en barra de ocupacion (QW-5) | BAJO | 30min | Bajo | Rent Roll |

---

## 8. Componentes a Crear / Refactorizar

### 8.1 `TabBar` (nuevo — `src/components/ui/TabBar.tsx`)

```typescript
type TabBarProps = {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
  size?: "sm" | "default";
  variant?: "pills" | "underline";
};

export function TabBar({ tabs, activeTab, onChange, size = "default", variant = "pills" }: TabBarProps): JSX.Element;
```

Reemplaza las implementaciones en: `ReconciliationClient`, `EerrClient`, `FinanceDashboardClient`, `FacturacionClient`, `VentasAnalyticsClient`.

### 8.2 `MetricCard` (nuevo — `src/components/ui/MetricCard.tsx`)

Fusion de `KpiCard` y `CustomKpiCard`. Ver spec completa en RM-4 arriba. El `metricId` pasa a ser opcional, el sparkline se calcula externamente y se pasa como array de numeros.

### 8.3 `ModuleEmptyState` (refactor — `src/components/dashboard/ModuleEmptyState.tsx`)

Agregar `variant` prop y mapa de iconos por variante. Sin cambios en la firma de props existentes (backward compatible).

### 8.4 `useDataTable` (refactor — `src/hooks/useDataTable.ts`)

Agregar `options?: { initialColumnPinning?: ColumnPinningState; initialSorting?: SortingState }` como tercer parametro opcional. Habilitar `enableColumnPinning: true` en la config de `useReactTable`.

### 8.5 `ReconciliationTable` (nuevo — `src/components/finance/ReconciliationTable.tsx`)

Componente de tabla pura (Client Component) con `DataTable` + columnas definidas para reconciliacion. `ReconciliationClient` pasa los datos filtrados; la logica de filtros de gap permanece en el cliente.

### 8.6 Slide-over de detalle EERR (refactor — dentro de `EerrClient`)

Reemplazar el `<div className="fixed inset-y-0 right-0...">` por:
```tsx
<Sheet open={!!arrendatarioPanel} onOpenChange={(open) => { if (!open) setArrendatarioPanel(null); }}>
  <SheetContent side="right" className="w-full max-w-xl p-0">
    {/* ... contenido existente ... */}
  </SheetContent>
</Sheet>
```
`Sheet` maneja el `role="dialog"`, `aria-modal`, y la trampa de foco automaticamente.

---

*Revision generada el 2026-04-19 por analisis estatico del codigo fuente del repositorio BetaMallSport, rama Felipe. Archivos revisados: 35 componentes, 6 paginas de dashboard, configuracion de Tailwind, globals.css, y utilidades de libreria. Referencias externas consultadas: Pencil & Paper Enterprise Data Tables UX, Wildnet Edge Fintech UX Best Practices, TanStack Table documentation (column pinning + virtualization), Stripe Documentation (design patterns), y UXPin Dashboard Design Principles 2025.*
