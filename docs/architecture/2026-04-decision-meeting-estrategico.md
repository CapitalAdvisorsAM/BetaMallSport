# Reporte de Decisiones Estratégicas — BetaMallSport

> **Fecha:** 2026-04-28
> **Autor:** Felipe Guzmán
> **Para:** reunión 1-a-1 con jefatura
> **Foco:** producto y operación, no tecnología
> **Versión:** 1.0

---

## 0. Por qué esta conversación

La plataforma ya tiene los huesos: 3 mundos (Plan / Real / Reconciliación), modelo de datos sólido, pipeline de carga funcional. Antes de seguir agregando reportes y vistas, conviene **fijar las reglas operacionales del producto**:

1. ¿Qué información guardamos y con qué formato?
2. ¿Cómo entra a la plataforma — Excel, formulario manual, o ambos?
3. ¿Cómo se corrige un dato cuando hay error?
4. ¿Cómo se edita información ya cargada?
5. ¿Qué pasa cuando un dato cambia: se sobreescribe o queda historial?
6. ¿Cuánto nos cuesta hoy y cuánto nos va a costar?

Estas decisiones **no son técnicas**: son decisiones de **producto**. Cada una tiene implicancias operativas para quien usa la plataforma día a día.

---

## 1. Catálogo de información que la plataforma maneja

| Entidad | Qué es | Granularidad | Frecuencia de cambio | Cómo entra hoy | Mundo |
|---|---|---|---|---|---|
| **Proyecto** | Un mall | Por instancia | Casi nunca | UI manual | Master |
| **Local** | Una unidad física (tienda, kiosco, bodega) | Por unidad | Cambios menores 1×/año | Excel + edición UI | Master |
| **Arrendatario** | Operador comercial (RUT) | Por entidad legal | Bajo | Excel + edición UI | Master |
| **Contrato** | Acuerdo arriendo local↔arrendatario | Por contrato | Alta al inicio, baja después | Excel masivo + UI | Plan |
| **Tarifa contractual** | Renta UF/m² o UF fija | Por vigencia (ej. 1 ene → 31 dic) | Renegociaciones, descuentos | Excel + UI | Plan |
| **GGCC contractuales** | Gastos comunes pactados | Por vigencia | Renegociaciones | Excel + UI | Plan |
| **Ventas presupuestadas** | Lo que el arrendatario proyecta vender | Mensual × arrendatario | Anual + ajustes | Excel mensual | Plan |
| **Presupuesto de gastos** | Plan de gastos del mall | Mensual × cuenta | Anual | Excel mensual | Plan |
| **Ventas reales** | Lo que efectivamente vendió el arrendatario | Mensual × arrendatario | Mensual | Excel (parser ✅, **NO se guarda hoy**) | Real |
| **Registros contables** | Asientos del libro mayor | Mensual × cuenta × local | Mensual | Excel (apply parcial) | Real |
| **Balances** | Estado de cuentas contables | Mensual | Mensual | Excel (parser ✅, **NO se guarda hoy**) | Real |
| **Movimientos bancarios** | Transacciones de cuentas | Diario | Diario/Mensual | Excel (parser ✅, **NO se guarda hoy**) | Real |
| **Energía** | Ingresos por consumo eléctrico | Mensual × local | Mensual | Excel | Real |
| **Valor UF** | Cotización oficial | Diario | Diario | Cron automático | Master |
| **Archivos PDF** | Contratos firmados | Por contrato | Bajo | Subida UI | Master |
| **Archivos Excel** | Insumos cargados | Por carga | Mensual | **HOY NO SE GUARDAN** | Audit |

**Lectura del cuadro:**
- **Plan funciona**: contratos, tarifas, GGCC, presupuestos — todo entra y se guarda.
- **Real está a medias**: 4 de 5 tipos de carga (ventas, balances, banco, presup gastos) llegan al preview pero **no se persisten en base de datos**. El operador carga el archivo, ve que está OK, y la plataforma no guarda nada útil para reportes posteriores.
- **Sin trazabilidad de archivos**: ningún Excel cargado queda almacenado. Si hay que volver a revisar qué se subió en marzo, solo queda el resultado en pantalla.

> 🚩 **Esta es la deuda más visible del producto hoy**: sin Real persistido, no hay reconciliación posible Plan-vs-Real.

---

## 2. Decisiones estratégicas a cerrar

### Bloque A — ¿Cómo entra la información?

#### A.1 Modo de entrada principal

**Decisión:** ¿Excel masivo, formulario UI manual, o híbrido por entidad?

**Trade-offs:**

| Modo | Ventaja | Desventaja |
|---|---|---|
| **Excel masivo** | Rápido para volumen alto (>50 filas); el operador ya trabaja en Excel | Frágil ante cambios de formato; errores difíciles de ubicar; sin validación en tiempo real |
| **Formulario UI** | Validación inmediata; sin riesgo de error de formato; trazable | Lento para volumen alto; requiere construir y mantener formularios |
| **Híbrido por entidad** | Lo mejor de ambos según naturaleza del dato | Requiere decidir caso por caso |

**Recomendación: HÍBRIDO**, decidido por la naturaleza del dato:

| Entidad | Modo recomendado | Por qué |
|---|---|---|
| Locales (catastro inicial) | **Excel** una vez, luego UI | El catastro tiene 100+ unidades; cargarlo a mano sería absurdo. Cambios posteriores son raros. |
| Arrendatarios | **Excel** una vez, luego UI | Mismo razonamiento. |
| Contratos | **UI manual** + Excel masivo opcional | Cada contrato es un evento del negocio que merece flujo dedicado (subir PDF, validar datos, etc.). Excel se reserva para migración inicial o cargas batch contadas. |
| Tarifas / GGCC | **UI manual** | Renegociaciones son individuales, una a una. Bitemporalidad ya implementada para esto. |
| Ventas presupuestadas | **Excel** mensual | Vienen de un sistema externo (típicamente del operador), nunca se editan a mano. |
| Ventas reales | **Excel** mensual | Idem. |
| Contabilidad / balances / banco | **Excel** mensual | Origen externo (ERP). Editar a mano sería reescribir la contabilidad. |

**Pregunta para el jefe:** ¿estás de acuerdo con esta tabla, o el operador tiene preferencias específicas que no estoy capturando?

---

#### A.2 ¿Qué hacer con archivos cargados? (auditoría)

Hoy: el Excel se lee a memoria y se descarta. Solo queda el resultado del parseo en base de datos.

**Opciones:**

| Política | Costo | Auditoría | Recomendación |
|---|---|---|---|
| No guardar nada (status quo) | $0 | 🚫 Imposible reconstruir qué se cargó | ❌ |
| Guardar 12 meses + checksum SHA-256 | ~USD 0,10/mes | ✅ Reconstrucción + detección de duplicados | ✅ **Recomendado** |
| Guardar siempre (sin retención) | ~USD 1/mes a 12 meses, crece infinito | ✅ Total | Solo si hay requerimiento legal |

**Recomendación:** Guardar todo Excel cargado en GCS (Google Cloud Storage) con retención 12 meses + checksum para detectar re-cargas idénticas. Costo despreciable, beneficio operativo grande.

**Pregunta para el jefe:** ¿hay requerimiento legal/auditoría que exija retención mayor a 12 meses?

---

#### A.3 ¿Qué pasa cuando una carga tiene errores?

**Realidad operativa:** un Excel mensual de ventas con 1.500 filas tiene casi siempre alguna fila con error (un RUT mal escrito, un período fuera de rango, un local que ya no existe). Hoy: se rechazan esas filas, las demás se aplican, y el operador tiene que corregir el Excel y volver a subirlo.

**Opciones:**

| Política | UX operador | Esfuerzo plataforma | Recomendación |
|---|---|---|---|
| Re-subir archivo corregido | Frustante en cargas grandes | $0 (status quo) | Aceptable para ventas/contabilidad |
| Edición inline en UI: corregir las filas con error sin volver a subir | Cómoda | Medio | Para entidades de alta fricción (ventas, contratos) |
| Bloquear la carga completa si hay >X errores | Forzaba calidad | Bajo | Como complemento, no como única política |
| Permitir cargas parciales con flag "completar después" | Flexible | Alto | Solo si el operador realmente lo necesita |

**Recomendación:** Empezar con re-subir (lo que ya funciona). Si el operador se queja específicamente por una entidad (probablemente ventas mensuales), agregar edición inline solo para esa.

**Pregunta para el jefe:** ¿el equipo operativo se ha quejado por re-subir archivos? ¿O todavía no hay usuarios produciendo dolor real?

---

### Bloque B — ¿Cómo se almacena la información?

#### B.1 ¿Datos vivos o congelados? (la decisión más importante)

**Pregunta de fondo:** cuando alguien mira "Rent Roll de marzo 2026" un año después, ¿debería ver:
- **(a)** Lo que se reportó en su momento (snapshot congelado), incluso si el dato fuente cambió, o
- **(b)** El cálculo recalculado con la información más actualizada disponible

**Por qué importa:** si en abril te das cuenta que una tarifa de marzo estaba mal y la corregís, el reporte de marzo cambia retroactivamente. Esto es bueno para análisis interno, pero **mata la auditabilidad** si el directorio firmó "renta de marzo = X UF" basado en el reporte de ese momento.

**Estado actual:** todo se reconstruye **en vivo**, salvo las tarifas que tienen historia bitemporal. Cualquier cambio retroactivo afecta reportes pasados.

**Opciones:**

| Política | Reportes históricos | Auditoría | Recomendación |
|---|---|---|---|
| Todo vivo (status quo) | Cambian al editar fuentes | Débil | OK para uso interno |
| Snapshot mensual selectivo (solo el rent roll cierra el día 5 del mes siguiente) | Estables después del cierre | Fuerte | ✅ **Recomendado si el directorio firma reportes** |
| Snapshot completo (toda la base) | Pesado, complejo | Fuerte | Overkill |

**Recomendación:** **Snapshot selectivo del rent roll mensual**. Política operativa propuesta:

- Día 5 del mes siguiente al cierre, la plataforma "congela" el rent roll de ese mes.
- Antes del día 5: se puede editar libremente.
- Después del día 5: cambios requieren un mecanismo formal de "enmienda" (anexo de contrato), que ya existe en la plataforma.

**Pregunta para el jefe** *(la más estratégica):* ¿el operador presenta a su directorio reportes mensuales que deben quedar firmados/inmutables? Si la respuesta es sí → snapshot obligatorio. Si es no → seguimos con todo vivo y ahorramos complejidad.

---

#### B.2 ¿Qué granularidad guardamos?

**Decisiones por entidad:**

| Entidad | Granularidad propuesta | Justificación |
|---|---|---|
| Tarifas | Por vigencia (ya implementado) | Permite tarifas retroactivas y descuentos por período |
| Ventas reales | Mensual × arrendatario | Estándar operacional; menor granularidad pierde detalle, mayor (ej. diaria) inflaría DB sin uso |
| Contabilidad | Mensual × cuenta × local × arrendatario | Permite slicing por dimensión; ya implementado |
| Movimientos bancarios | Por transacción (diaria) | El estado de cuenta del banco viene así; agregarlo perdería trazabilidad de pago |
| Presupuestos | Mensual × cuenta | Igual que actuales |
| Historial de edits manuales | Por evento (quién, cuándo, qué) | Mínimo necesario para auditoría |

**Pregunta para el jefe:** ¿hay alguna métrica que necesites con granularidad distinta? (ej. ventas diarias para un mall específico).

---

#### B.3 Backups y continuidad

**Hoy:** la base de datos tiene recovery automático de 7 días (Neon free tier). No hay export externo.

**Riesgo:** si la base de datos cae como proveedor o cometemos un error catastrófico, perdemos hasta 7 días.

**Recomendación:** cron diario que exporta toda la base a un bucket de Google con retención 30 días + 1 backup mensual permanente. Costo: prácticamente cero (USD 0,10/mes para nuestra escala). Esfuerzo: 1 día de trabajo.

**Pregunta para el jefe:** ninguna. Esto es básico y lo implemento.

---

### Bloque C — ¿Cómo se edita la información?

#### C.1 Edición inline: ¿qué entidades pueden editarse en la UI?

**Estado actual:** la UI permite editar contratos (full form), locales y arrendatarios (form básico). NO permite editar ventas reales, contabilidad, balances ni movimientos bancarios — esos solo entran por Excel.

**Recomendación por entidad:**

| Entidad | ¿Editable en UI? | Por qué |
|---|---|---|
| Contratos (cabecera, fechas, flags) | ✅ Sí | Ya funciona |
| Tarifas / GGCC (con historia) | ✅ Sí | Ya funciona, con bitemporalidad |
| Locales (atributos) | ✅ Sí | Bajo riesgo |
| Arrendatarios (datos legales) | ✅ Sí | Bajo riesgo |
| Ventas presupuestadas | ✅ Sí | Útil para ajustes finos |
| Ventas reales | 🚫 No | Origen es el ERP del operador; editar a mano sería falsear datos |
| Contabilidad | 🚫 No | Mismo motivo |
| Balances / banco | 🚫 No | Mismo motivo |
| Presupuesto de gastos | ✅ Sí | Para ajustes durante el año |

**Principio:** "lo que viene de un sistema autoritativo externo NO se edita en la plataforma; lo que es decisión interna SÍ".

**Pregunta para el jefe:** ¿estás de acuerdo con este principio? ¿Hay casos en que necesites editar ventas/contabilidad a mano (ej. corregir un valor errado del operador)?

---

#### C.2 Permisos: ¿quién puede editar qué?

**Estado actual:** 3 roles globales — `ADMIN` (todo), `OPERACIONES` (lectura/escritura), `VIEWER` (solo lectura). Si tienes rol OPERACIONES, podés editar cualquier proyecto del sistema.

**Pregunta clave:** ¿la plataforma va a operar UN solo mall, o varios?

**Si es uno solo:** los 3 roles globales bastan.

**Si son varios:**
- Hoy: cualquier OPERACIONES de un mall puede editar datos de otro. Riesgo real de fuga de datos.
- Necesitamos: permisos por proyecto (ej. "Juan es OPERACIONES en Mall A pero VIEWER en Mall B").

**Recomendación:** depende del Bloque A.1 + plan de negocio. Si en 12 meses vamos a tener N malls de N operadores → implementar permisos por proyecto desde ya. Si no → diferir.

**Pregunta para el jefe:** ¿BetaMallSport es producto interno (1 mall) o se va a vender a otros operadores en el corto plazo?

---

#### C.3 Auditoría: ¿qué cambió, quién, cuándo?

**Estado actual:**
- ✅ **Contratos**: existe tabla `ContractAmendment` que registra cada edición con snapshot antes/después.
- 🚫 **Tarifas**: ya bitemporales, pero el "quién" (usuario) y "por qué" (descripción) se registran solo si el cambio entra por anexo formal.
- 🚫 **Locales / Arrendatarios / otros**: edición silenciosa, sin historial.
- 🚫 **Cargas Excel**: queda registro de la carga en sí, no de los datos individuales que cambió.

**Decisión:** ¿auditamos todo o solo lo crítico?

| Política | Beneficio | Costo |
|---|---|---|
| Auditar solo contratos (status quo) | Cubre lo legalmente sensible | Bajo |
| Auditar contratos + tarifas + maestros (locales, arrendatarios) | Cubre el 90% del valor | Medio (~2 semanas implementación) |
| Auditar todo (incluso ventas) | Total | Alto (gran inflar de la base de datos) |

**Recomendación:** intermedia. Auditar todas las **decisiones internas** (contratos, tarifas, ediciones de maestros). NO auditar datos transaccionales que vienen de Excel (ventas, contabilidad) — para esos basta saber "vino de la carga X del archivo Y subido por Z".

**Pregunta para el jefe:** ¿hay un caso histórico en que se haya necesitado responder "¿quién cambió este dato y cuándo?" y no se haya podido?

---

### Bloque D — ¿Qué pasa cuando un dato cambia?

#### D.1 Cambios en tarifas (ya resuelto)

Cuando una tarifa cambia (renegociación, descuento, ajuste por IPC):
- Se cierra la vigencia de la tarifa antigua.
- Se inserta una nueva con `vigenciaDesde` = fecha del cambio.
- La tarifa antigua queda "superseded" pero no se borra.
- Cualquier reporte que pregunte "¿cuál era la tarifa el 15 de marzo?" responde correctamente.

✅ **Esto ya funciona y es correcto.**

---

#### D.2 Cambios en datos maestros (local, arrendatario)

**Ejemplo:** un local cambia su `glam2` (m² arrendables) porque se hizo una remodelación.

**Pregunta:** ¿los reportes de meses anteriores deberían usar el GLA antiguo o el nuevo?

**Opciones:**

| Política | Reportes anteriores | Reportes nuevos | Complejidad |
|---|---|---|---|
| Sobreescribir GLA, sin historia | Cambian retroactivamente | Correctos | Baja (status quo) |
| Versionar GLA con vigencia | Estables | Correctos | Alta |

**Recomendación:** **sobreescribir** para datos maestros simples (nombre, RUT, email) y **versionar** solo lo que afecta cálculos económicos (GLA, tipo de unidad, esGLA flag).

**Pregunta para el jefe:** ¿la remodelación de un local que cambia su m² es algo que pasa? Si sí → versionar GLA. Si no → sobreescribir.

---

#### D.3 Cambios retroactivos en ventas / contabilidad

**Ejemplo:** el ERP del operador detecta en mayo que las ventas de marzo estaban mal y manda un Excel corregido.

**Opciones:**

| Política | Comportamiento | Riesgo |
|---|---|---|
| Sobreescribir las ventas viejas | Reportes recalculan | Si ya hubo decisiones (renta variable cobrada) basadas en el dato antiguo, hay inconsistencia |
| Mantener ventas antiguas + agregar versión nueva | Auditoría completa | Reportes deben elegir versión |
| Sobreescribir + congelar reportes mensuales (Bloque B.1) | Auditoría preserva el reporte en su momento | Requiere snapshot |

**Recomendación:** **sobreescribir** las ventas, **pero** si Bloque B.1 acepta snapshot mensual, los reportes mensuales firmados quedan inmutables aunque las ventas subyacentes cambien después.

**Pregunta para el jefe:** ¿con qué frecuencia el operador manda correcciones a ventas/contabilidad ya cargadas?

---

#### D.4 Cambios en contratos vigentes

**Ejemplo:** un contrato firmado en enero se descubre en abril que tenía un error en la fecha de inicio.

**Mecanismo actual:** la edición se hace via el formulario de contrato y queda registrada como `ContractAmendment` con snapshot antes/después.

✅ **Esto ya funciona.** No hay decisión pendiente.

---

## 3. Costos: hoy y proyección a 12 meses

> Asumiendo escala: 1–5 malls, ~150 contratos cada uno, ~2K filas de Excel por carga mensual, 1–5 usuarios concurrentes.

### Costos de infraestructura (USD/mes)

| Componente | Hoy (1 mall, free tiers) | 6 meses (1 mall, producción) | 12 meses (3–5 malls) |
|---|---|---|---|
| **Base de datos (Neon)** | $0 (free: 0,5 GB) | $19 (Launch: 10 GB) | $19–69 (Launch o Scale) |
| **Compute (Cloud Run)** | $0 (free tier) | $0–5 | $5–20 |
| **Storage (Google Cloud Storage)** | $0 (~ centavos) | $0,50 | $2 |
| **Auth (Google OAuth)** | $0 | $0 | $0 |
| **Errores (Sentry)** | $0 (free: 5K eventos) | $0 (sigue free) | $0–26 (Team plan si crece) |
| **Logs (Cloud Logging)** | $0 (free: 50 GB/mes) | $0 | $0 |
| **Job queue (Cloud Tasks)** | $0 (free: 1M ops/mes) | $0 | $0 |
| **Backups** | $0,10 | $0,10 | $0,30 |
| **Total mensual** | **~$0** | **~$25** | **~$30–120** |

**Lectura:** la infraestructura es despreciable a la escala objetivo. **El costo real de la plataforma es el tiempo de desarrollo**, no la infraestructura.

### Costo de desarrollo (USD/hora-dev)

| Decisión | Esfuerzo dev | Costo dev (a $50/h) | Costo dev (a $100/h) |
|---|---|---|---|
| Persistir 5 uploads que faltan (ventas, banco, etc.) | 100 hrs | $5K | $10K |
| Snapshot mensual selectivo | 60 hrs | $3K | $6K |
| Permisos por proyecto (multi-tenant) | 120 hrs | $6K | $12K |
| Edición inline filas erradas | 80 hrs | $4K | $8K |
| Versionar GLA del local | 30 hrs | $1,5K | $3K |
| Auditoría de cambios en maestros | 50 hrs | $2,5K | $5K |
| Backups automáticos | 10 hrs | $0,5K | $1K |
| **Total roadmap balanceado** | ~450 hrs | **~$22K** | **~$45K** |

**Lectura:** las decisiones que tomemos hoy se traducen en 2–4 meses de desarrollo en los próximos 12 meses. La infraestructura es gratis comparado con esto.

### Comparación con alternativa "comprar una plataforma SaaS"

Plataformas comparables en mercado retail real estate (Yardi, Argus, AppFolio): **USD 200–800 / mall / mes**, contratos anuales. Para 5 malls: USD 12K–48K/año solo en licencias, sin contar implementación.

**Conclusión:** desarrollar in-house tiene sentido económicamente si el operador opera ≥3 malls o si requiere personalización fuerte (que es nuestro caso por la integración con sistemas locales chilenos).

---

## 4. Cuadro de decisiones a cerrar (agenda de la reunión)

> Cada fila es una decisión que **espera tu sí o no**. El detalle está arriba.

| # | Decisión | Mi recomendación | Necesito que decidas |
|---|---|---|---|
| 1 | ¿Excel masivo, UI manual o híbrido por entidad? | **Híbrido** según tabla A.1 | ✅ ¿De acuerdo o ajustes? |
| 2 | ¿Guardamos los Excel cargados? | **Sí**, GCS, retención 12 meses + checksum | ✅ ¿Sirve 12 meses? |
| 3 | ¿Edición inline para corregir errores? | **No por ahora**, re-subir | ✅ ¿Operador se queja? |
| 4 | ¿Snapshot mensual congelado del rent roll? | **Sí si el directorio firma reportes** | 🔴 **CRÍTICA**: ¿directorio firma o no? |
| 5 | ¿Cuáles entidades editables en UI? | Maestros y contratos sí; ventas/contabilidad no | ✅ ¿De acuerdo o casos especiales? |
| 6 | ¿Permisos por proyecto? | **Sí si va a haber N malls de N operadores** | 🔴 **CRÍTICA**: ¿es producto interno o vendible? |
| 7 | ¿Auditoría de cambios en maestros? | **Sí**, decisiones internas pero no datos transaccionales | ✅ ¿Caso real que lo justifique? |
| 8 | ¿Versionar GLA del local? | **Sí si pasan remodelaciones** | ✅ ¿Pasa o no pasa? |
| 9 | ¿Backups externos? | **Sí**, sin discusión | ✅ Lo hago |

**Las dos decisiones críticas:** #4 (snapshot) y #6 (multi-tenant). Las demás son refinamientos.

---

## 5. Recomendación de cierre

Mi propuesta para los próximos 6 meses, dependiendo de lo que decidamos hoy:

### Si producto interno (1 mall, sin reportes firmados):
- Backups (1 día)
- Persistir los 5 uploads que faltan (4 semanas)
- Excel cargados a GCS con auditoría (1 semana)
- Auditoría de maestros (2 semanas)

**Total:** ~7–8 semanas de dev. Plataforma queda completa para uso interno.

### Si producto interno con reportes firmados:
Lo anterior + snapshot mensual (3 semanas).

**Total:** ~10–11 semanas.

### Si producto vendible a múltiples operadores:
Lo anterior + multi-tenant + permisos por proyecto + integración API (en H2).

**Total:** ~6 meses de dev pesado. Producto SaaS real al final.

---

## Anexo — Glosario

- **GLA**: m² arrendables del mall (Gross Leasable Area).
- **Renta fija**: arriendo en UF/m² o UF/mes, no depende de ventas.
- **Renta variable**: % sobre ventas del arrendatario sobre umbrales.
- **GGCC**: Gastos Comunes prorrateados (administración + tarifa base).
- **Vacancia**: GLA sin contrato vigente / GLA total.
- **Plan**: lo que dicen los contratos (expectativa).
- **Real**: lo que se facturó / vendió de verdad (realidad).
- **Reconciliación**: diferencia Plan vs Real.
- **Bitemporalidad**: guardar tanto la fecha de vigencia como la fecha en que se registró.
- **Snapshot**: foto congelada de un dato a una fecha específica.
- **Apply**: paso de un Excel cargado a guardar los datos en la base.
- **Preview**: paso intermedio donde se valida el Excel antes de guardar.

---

*Fin del reporte. Versión 1.0 — borrador estratégico para revisión 1-a-1.*
