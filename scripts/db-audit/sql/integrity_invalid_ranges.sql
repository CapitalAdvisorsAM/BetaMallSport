SELECT
  'Contrato.fechaInicio > Contrato.fechaTermino' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "Contrato"
WHERE "fechaInicio" > "fechaTermino"

UNION ALL

SELECT
  'ContratoTarifa.vigenciaDesde > vigenciaHasta' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoTarifa"
WHERE "vigenciaHasta" IS NOT NULL
  AND "vigenciaDesde" > "vigenciaHasta"

UNION ALL

SELECT
  'ContratoGGCC.vigenciaDesde > vigenciaHasta' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoGGCC"
WHERE "vigenciaHasta" IS NOT NULL
  AND "vigenciaDesde" > "vigenciaHasta"

UNION ALL

SELECT
  'Contrato.estado inconsistente con vigencia efectiva' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "Contrato" c
WHERE (
    CURRENT_DATE < c."fechaInicio"
    AND c.estado IN ('VIGENTE', 'GRACIA')
  ) OR (
    CURRENT_DATE > (c."fechaTermino" + make_interval(days => COALESCE(c."diasGracia", 0)))::date
    AND c.estado IN ('VIGENTE', 'GRACIA')
  )

UNION ALL

SELECT
  'ContratoDia.fecha fuera de vigencia efectiva del contrato' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoDia" cd
JOIN "Contrato" c ON c.id = cd."contratoId"
WHERE cd."contratoId" IS NOT NULL
  AND (
    cd.fecha < c."fechaInicio"
    OR cd.fecha > (c."fechaTermino" + make_interval(days => COALESCE(c."diasGracia", 0)))::date
  )
ORDER BY affected_rows DESC, check_name;
