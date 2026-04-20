# Auditoría de Base de Datos - production

## Resumen ejecutivo

- Fecha de ejecución: 2026-04-20
- Zona horaria de reporte: **America/Santiago**
- Estado esquema/migraciones: **drift detectado**
- Motor observado: **PostgreSQL 17.8 (a48d9ca) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit**
- Usuario auditado: **neondb_owner**
- Transacción de auditoría: **READ ONLY = on**
- Extensiones clave: **pg_trgm = sí**, **pg_stat_statements = no**

## Riesgos prioritarios

### [CRITICAL] Contratos superpuestos sobre un mismo local

- Evidencia: 8 pares de contratos activos/gracia se superponen en el mismo local.
- Impacto: Riesgo de duplicar ocupación, renta esperada y métricas de vencimiento.
- Recomendación: Corregir datos y agregar una validación persistente previa a altas/ediciones masivas.
- Evidencia reproducible: `scripts/db-audit/sql/integrity_contract_overlap.sql`


### [CRITICAL] La credencial auditada no opera con privilegios read-only mínimos

- Evidencia: CREATE en base; TEMP en base; CREATE en esquema public; 30 tablas con INSERT/UPDATE/DELETE/TRUNCATE
- Impacto: La auditoría se ejecuta segura por transacción read-only, pero la credencial subyacente sigue sobredimensionada para producción.
- Recomendación: Crear un rol dedicado de auditoría/lectura y rotar DATABASE_URL productivo a privilegios mínimos.
- Evidencia reproducible: `scripts/db-audit/sql/security_role_privileges.sql`, `scripts/db-audit/sql/security_table_privileges.sql`


### [HIGH] Se detectaron rangos temporales inválidos o estados incoherentes

- Evidencia: 6 filas afectadas en 1 chequeos temporales.
- Impacto: Afecta el cálculo de vigencias, días de gracia, timeline y rent roll diario.
- Recomendación: Normalizar fechas inválidas y reconciliar estados calculados versus persistidos.
- Evidencia reproducible: `scripts/db-audit/sql/integrity_invalid_ranges.sql`


### [HIGH] Schema/migraciones con drift respecto del repo

- Evidencia: 8 objetos en estado drift entre Prisma, migraciones y PostgreSQL.
- Impacto: Eleva el riesgo de despliegues inconsistentes, regresiones silenciosas y pérdida de trazabilidad.
- Recomendación: Resolver diferencias antes de nuevas migraciones y formalizar índices/manuales pendientes.
- Evidencia reproducible: `scripts/db-audit/sql/migrations_applied.sql`, `scripts/db-audit/sql/table_inventory.sql`, `scripts/db-audit/sql/index_inventory.sql`


### [HIGH] La credencial puede leer PII y tokens de autenticación

- Evidencia: 5 tablas sensibles legibles y 8 columnas sensibles inventariadas.
- Impacto: Un uso impropio de la credencial permitiría exfiltración de sesiones, tokens OAuth o datos personales básicos.
- Recomendación: Segregar credenciales por uso, limitar SELECT sobre tablas auth y revisar necesidad de retener tokens en claro.
- Evidencia reproducible: `scripts/db-audit/sql/security_table_privileges.sql`, `scripts/db-audit/sql/column_inventory.sql`


### [MEDIUM] Hay valores financieros u operativos fuera de rango esperado

- Evidencia: 5 filas anómalas en 1 chequeos de rango.
- Impacto: Puede distorsionar KPIs, presupuesto versus real y simulaciones de renta/GGCC.
- Recomendación: Revisar cargas históricas y agregar validaciones explícitas de rango en formularios y ETL.
- Evidencia reproducible: `scripts/db-audit/sql/integrity_value_ranges.sql`


## Lectura ejecutiva

- Hallazgos críticos: **2**
- Hallazgos altos: **3**
- El mayor riesgo operativo es contratos superpuestos sobre un mismo local.
- El mayor riesgo de gobierno de datos es la credencial puede leer pii y tokens de autenticación.

## Áreas que más conviene revisar primero

- Dashboard y métricas: `src/app/api/dashboard/metricas/route.ts` - Concentra agregaciones de rent roll y combina contratos, tarifas, GGCC y ocupación.
- Contratos y anexos: `src/app/api/contracts/[id]/route.ts` - Lee y persiste múltiples relaciones por contrato; alto riesgo de integridad temporal.
- Rent roll timeline: `src/lib/rent-roll/timeline.ts` - Depende de ContratoDia y fechas efectivas; sensible a inconsistencias y rendimiento.
- Finanzas y conciliación: `src/app/api/finance/reconciliation/route.ts` - Cruza ventas, registros contables, mappings y contratos; propenso a drift funcional.
- Exportaciones masivas: `src/app/api/export/excel/route.ts` - Superficie de lectura intensiva y potencial exposición amplia de datos.

## Bloqueos y lagunas

- No hubo bloqueos de consulta durante esta ejecución.
