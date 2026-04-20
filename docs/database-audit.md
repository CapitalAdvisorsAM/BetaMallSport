# Auditoría de Base de Datos

Este repo incluye un runner read-only para auditar PostgreSQL en ambientes remotos sin ejecutar migraciones, `db push`, escrituras ni DDL.

## Uso

```bash
npm run audit:db:prod
```

El script:

- carga variables desde `.env` si no están en el entorno;
- ejecuta cada consulta dentro de una transacción `READ ONLY`;
- compara `prisma/schema.prisma`, `prisma/migrations` y el esquema real;
- genera entregables en `reports/database-audit/`.

## Entregables generados

- `*-executive-summary.md`: resumen ejecutivo orientado a riesgo e impacto.
- `*-technical-annex.md`: evidencia técnica, matriz de drift, métricas y backlog.
- `*-summary.json`: resumen estructurado para automatización o diff entre corridas.

## Cobertura

- baseline operativo y extensiones;
- drift entre Prisma, migraciones y PostgreSQL;
- integridad temporal y relacional;
- privilegios efectivos del usuario auditado;
- tamaño/uso de tablas e índices;
- observabilidad con `pg_stat_statements` cuando está disponible.

## Límites deliberados

- no persiste datos crudos sensibles en los reportes;
- no muta la base de datos;
- si una vista o consulta opcional no está disponible por permisos, la deja registrada como bloqueo en el informe.
