SELECT
  'Local.glam2 <= 0' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "Local"
WHERE glam2 <= 0

UNION ALL

SELECT
  'Contrato.pctFondoPromocion fuera de [0,100]' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "Contrato"
WHERE "pctFondoPromocion" IS NOT NULL
  AND ("pctFondoPromocion" < 0 OR "pctFondoPromocion" > 100)

UNION ALL

SELECT
  'ContratoGGCC.pctAdministracion fuera de [0,100]' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoGGCC"
WHERE "pctAdministracion" < 0 OR "pctAdministracion" > 100

UNION ALL

SELECT
  'ContratoGGCC.pctReajuste fuera de [0,100]' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoGGCC"
WHERE "pctReajuste" IS NOT NULL
  AND ("pctReajuste" < 0 OR "pctReajuste" > 100)

UNION ALL

SELECT
  'ContratoTarifa.valor negativo' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoTarifa"
WHERE valor < 0

UNION ALL

SELECT
  'ContratoTarifa.umbralVentasUf negativo' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoTarifa"
WHERE "umbralVentasUf" IS NOT NULL
  AND "umbralVentasUf" < 0

UNION ALL

SELECT
  'ContratoTarifa.pisoMinimoUf negativo' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "ContratoTarifa"
WHERE "pisoMinimoUf" IS NOT NULL
  AND "pisoMinimoUf" < 0

UNION ALL

SELECT
  'VentaArrendatario.ventasUf negativa' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "VentaArrendatario"
WHERE "ventasUf" < 0

UNION ALL

SELECT
  'VentaPresupuestadaArrendatario.ventasUf negativa' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "VentaPresupuestadaArrendatario"
WHERE "ventasUf" < 0

UNION ALL

SELECT
  'IngresoEnergia.valorUf negativo' AS check_name,
  COUNT(*)::bigint AS affected_rows
FROM "IngresoEnergia"
WHERE "valorUf" < 0
ORDER BY affected_rows DESC, check_name;
