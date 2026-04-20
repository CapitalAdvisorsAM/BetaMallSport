# Anexo técnico - Auditoría de Base de Datos (production)

## Baseline operativo

- Base: **neondb**
- Schema activo: **public**
- Usuario: **neondb_owner**
- Timezone servidor: **GMT**
- `_prisma_migrations`: **disponible**
- Migraciones en repo: **34**
- Migraciones registradas en DB: **36**

## Tamaño por tabla

| Tabla | Filas est. | Total | Tabla | Índices |
| --- | --- | --- | --- | --- |
| RegistroContable | 6.911 | 5.20 MB | 2.71 MB | 2.45 MB |
| CargaDatos | 32 | 696.0 KB | 16.0 KB | 96.0 KB |
| Contrato | 130 | 248.0 KB | 48.0 KB | 160.0 KB |
| ContratoTarifa | 262 | 184.0 KB | 40.0 KB | 104.0 KB |
| Local | 147 | 176.0 KB | 40.0 KB | 96.0 KB |
| Arrendatario | 95 | 128.0 KB | 16.0 KB | 80.0 KB |
| MapeoLocalContable | 127 | 112.0 KB | 16.0 KB | 64.0 KB |
| ContratoGGCC | 89 | 104.0 KB | 16.0 KB | 48.0 KB |
| ContratoLocal | -1 | 80.0 KB | 8.00 KB | 64.0 KB |
| Proyecto | -1 | 80.0 KB | 8.00 KB | 64.0 KB |

## Índices observados

| Tabla | Índice | Scans | Tamaño |
| --- | --- | --- | --- |
| RegistroContable | RegistroContable_unique_with_unit | 0 | 896.0 KB |
| RegistroContable | RegistroContable_pkey | 39.364 | 584.0 KB |
| RegistroContable | RegistroContable_localId_periodo_idx | 161 | 224.0 KB |
| RegistroContable | RegistroContable_arrendatarioId_periodo_idx | 20 | 176.0 KB |
| RegistroContable | RegistroContable_proyectoId_grupo1_periodo_idx | 285 | 176.0 KB |
| RegistroContable | RegistroContable_proyectoId_periodo_idx | 496 | 128.0 KB |
| RegistroContable | RegistroContable_proyectoId_grupo3_periodo_idx | 6 | 88.0 KB |
| RegistroContable | RegistroContable_proyectoId_arrendatarioId_periodo_idx | 36 | 88.0 KB |
| RegistroContable | RegistroContable_property_level_key | 3.643 | 80.0 KB |
| RegistroContable | RegistroContable_unique_no_unit | 0 | 64.0 KB |

## Matriz de drift / objetos críticos

| Tipo | Objeto | Estado | Detalle |
| --- | --- | --- | --- |
| manual-index | Contrato_numeroContrato_trgm_idx | drift | Índice esperado por script manual no encontrado. |
| manual-index | Local_codigo_trgm_idx | drift | Índice esperado por script manual no encontrado. |
| manual-index | Local_nombre_trgm_idx | drift | Índice esperado por script manual no encontrado. |
| manual-index | Arrendatario_nombreComercial_trgm_idx | drift | Índice esperado por script manual no encontrado. |
| manual-index | Arrendatario_rut_trgm_idx | drift | Índice esperado por script manual no encontrado. |
| manual-index | ContratoTarifa_contratoId_tipo_vigencia_idx | drift | Índice esperado por script manual no encontrado. |
| manual-index | ContratoGGCC_contratoId_vigenciaDesde_idx | manual-no-versionado | Índice detectado y mantenido fuera de migraciones Prisma. |
| deprecated-column | Contrato.pctAdministracionGgcc | obsoleto | Columna deprecated aún presente; revisar retiro controlado. |
| migration | 20260403140000_nullable_localid_registro_contable | drift | Migración registrada en la BD pero ausente en el repo local. |

## Integridad y calidad de datos

### Chequeos con diferencias por proyecto

No se detectaron mismatches de projectId en los chequeos cubiertos.

### Rangos temporales inválidos

| Chequeo | Filas afectadas |
| --- | --- |
| Contrato.estado inconsistente con vigencia efectiva | 6 |

### Rangos financieros / operativos

| Chequeo | Filas afectadas |
| --- | --- |
| Local.glam2 <= 0 | 5 |

### ContratoDia

No se detectaron inconsistencias en ContratoDia en los chequeos cubiertos.

### Contratos superpuestos

- Pares detectados: **8**
- Query reproducible: `scripts/db-audit/sql/integrity_contract_overlap.sql`

## Seguridad y acceso

### Privilegios con capacidad de escritura

| Tabla | INSERT | UPDATE | DELETE | TRUNCATE |
| --- | --- | --- | --- | --- |
| Account | true | true | true | true |
| AlertaFacturacion | true | true | true | true |
| Arrendatario | true | true | true | true |
| CargaDatos | true | true | true | true |
| Contrato | true | true | true | true |
| ContratoAnexo | true | true | true | true |
| ContratoDia | true | true | true | true |
| ContratoGGCC | true | true | true | true |
| ContratoLocal | true | true | true | true |
| ContratoTarifa | true | true | true | true |
| CustomWidget | true | true | true | true |
| DashboardConfig | true | true | true | true |
| IngresoEnergia | true | true | true | true |
| Local | true | true | true | true |
| MapeoLocalContable | true | true | true | true |
| MapeoVentasArrendatario | true | true | true | true |
| Proyecto | true | true | true | true |
| RegistroContable | true | true | true | true |
| Session | true | true | true | true |
| User | true | true | true | true |
| ValorUF | true | true | true | true |
| VentaArrendatario | true | true | true | true |
| VentaPresupuestadaArrendatario | true | true | true | true |
| VentaPresupuestadaLocal | true | true | true | true |
| VerificationToken | true | true | true | true |
| ZonaLocal | true | true | true | true |
| _prisma_migrations | true | true | true | true |

### Cobertura de tablas sensibles

- Tablas auth/PII inventariadas: `Account`, `Session`, `VerificationToken`, `User`, `Arrendatario`
- Columnas sensibles destacadas: `access_token`, `refresh_token`, `id_token`, `sessionToken`, `token`, `email`, `telefono`

## Hallazgos priorizados

1. [CRITICAL] Contratos superpuestos sobre un mismo local
   Evidencia: 8 pares de contratos activos/gracia se superponen en el mismo local.
   Impacto: Riesgo de duplicar ocupación, renta esperada y métricas de vencimiento.
   Remediación: Corregir datos y agregar una validación persistente previa a altas/ediciones masivas.
   Query: `scripts/db-audit/sql/integrity_contract_overlap.sql`

2. [CRITICAL] La credencial auditada no opera con privilegios read-only mínimos
   Evidencia: CREATE en base; TEMP en base; CREATE en esquema public; 27 tablas con INSERT/UPDATE/DELETE/TRUNCATE
   Impacto: La auditoría se ejecuta segura por transacción read-only, pero la credencial subyacente sigue sobredimensionada para producción.
   Remediación: Crear un rol dedicado de auditoría/lectura y rotar DATABASE_URL productivo a privilegios mínimos.
   Query: `scripts/db-audit/sql/security_role_privileges.sql + security_table_privileges.sql`

3. [HIGH] Se detectaron rangos temporales inválidos o estados incoherentes
   Evidencia: 6 filas afectadas en 1 chequeos temporales.
   Impacto: Afecta el cálculo de vigencias, días de gracia, timeline y rent roll diario.
   Remediación: Normalizar fechas inválidas y reconciliar estados calculados versus persistidos.
   Query: `scripts/db-audit/sql/integrity_invalid_ranges.sql`

4. [HIGH] Schema/migraciones con drift respecto del repo
   Evidencia: 7 objetos en estado drift entre Prisma, migraciones y PostgreSQL.
   Impacto: Eleva el riesgo de despliegues inconsistentes, regresiones silenciosas y pérdida de trazabilidad.
   Remediación: Resolver diferencias antes de nuevas migraciones y formalizar índices/manuales pendientes.
   Query: `scripts/db-audit/sql/_prisma_migrations + introspección de tablas/índices`

5. [HIGH] La credencial puede leer PII y tokens de autenticación
   Evidencia: 5 tablas sensibles legibles y 8 columnas sensibles inventariadas.
   Impacto: Un uso impropio de la credencial permitiría exfiltración de sesiones, tokens OAuth o datos personales básicos.
   Remediación: Segregar credenciales por uso, limitar SELECT sobre tablas auth y revisar necesidad de retener tokens en claro.
   Query: `scripts/db-audit/sql/security_table_privileges.sql + column_inventory.sql`

6. [MEDIUM] Hay valores financieros u operativos fuera de rango esperado
   Evidencia: 5 filas anómalas en 1 chequeos de rango.
   Impacto: Puede distorsionar KPIs, presupuesto versus real y simulaciones de renta/GGCC.
   Remediación: Revisar cargas históricas y agregar validaciones explícitas de rango en formularios y ETL.
   Query: `scripts/db-audit/sql/integrity_value_ranges.sql`

7. [LOW] Observabilidad de queries incompleta
   Evidencia: No se pudo consultar pg_stat_statements en esta ejecución.
   Impacto: La priorización de performance depende más de estadísticas de tabla/índice que de latencia por query real.
   Remediación: Habilitar o exponer pg_stat_statements al rol de auditoría.
   Query: `scripts/db-audit/sql/performance_top_statements.sql`

## Backlog por olas

### Ola 1 - Riesgos críticos de integridad y seguridad

- Crear un rol read-only real para auditoría/analítica productiva.
- Corregir contratos superpuestos y bloquear nuevas superposiciones.
- Corregir incoherencias de projectId entre tablas relacionadas.

### Ola 2 - Drift y deuda de migraciones

- Conciliar _prisma_migrations con carpetas del repo.
- Versionar o documentar formalmente índices/manuales fuera de Prisma.
- Planificar retiro seguro de columnas deprecated y restos de migraciones transicionales.

### Ola 3 - Performance y costo

- Analizar tablas grandes con seq_scan dominante contra rutas hotspot.
- Revisar índices grandes sin uso y confirmar si son deuda o cobertura estacional.
- Habilitar métricas de query-level con pg_stat_statements para siguiente iteración.

### Ola 4 - Limpieza de modelo y observabilidad

- Reducir superficie de lectura sensible en tablas auth y PII.
- Automatizar esta auditoría read-only en ambientes controlados.
- Agregar chequeos recurrentes de integridad sobre fechas, rangos y snapshots diarios.

## Queries utilizadas

- `scripts/db-audit/sql/baseline_metadata.sql`
- `scripts/db-audit/sql/extensions.sql`
- `scripts/db-audit/sql/table_inventory.sql`
- `scripts/db-audit/sql/enum_inventory.sql`
- `scripts/db-audit/sql/column_inventory.sql`
- `scripts/db-audit/sql/index_inventory.sql`
- `scripts/db-audit/sql/table_stats.sql`
- `scripts/db-audit/sql/index_stats.sql`
- `scripts/db-audit/sql/migrations_applied.sql`
- `scripts/db-audit/sql/security_role_privileges.sql`
- `scripts/db-audit/sql/security_table_privileges.sql`
- `scripts/db-audit/sql/integrity_contract_overlap.sql`
- `scripts/db-audit/sql/integrity_project_mismatches.sql`
- `scripts/db-audit/sql/integrity_invalid_ranges.sql`
- `scripts/db-audit/sql/integrity_value_ranges.sql`
- `scripts/db-audit/sql/integrity_contract_day_status.sql`
- `scripts/db-audit/sql/performance_top_statements.sql`

## Limitaciones

- Sin limitaciones relevantes en esta ejecución.
