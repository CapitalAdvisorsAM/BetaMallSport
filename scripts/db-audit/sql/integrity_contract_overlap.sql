WITH contract_units AS (
  SELECT
    c.id AS contrato_id,
    c."numeroContrato" AS numero_contrato,
    c."proyectoId" AS proyecto_id,
    c."fechaInicio" AS fecha_inicio,
    (c."fechaTermino" + make_interval(days => COALESCE(c."diasGracia", 0)))::date AS fecha_fin_efectiva,
    c.estado,
    c."localId" AS local_id
  FROM "Contrato" c

  UNION

  SELECT
    c.id AS contrato_id,
    c."numeroContrato" AS numero_contrato,
    c."proyectoId" AS proyecto_id,
    c."fechaInicio" AS fecha_inicio,
    (c."fechaTermino" + make_interval(days => COALESCE(c."diasGracia", 0)))::date AS fecha_fin_efectiva,
    c.estado,
    cl."localId" AS local_id
  FROM "Contrato" c
  JOIN "ContratoLocal" cl ON cl."contratoId" = c.id
),
normalized AS (
  SELECT DISTINCT
    contrato_id,
    numero_contrato,
    proyecto_id,
    local_id,
    fecha_inicio,
    fecha_fin_efectiva,
    estado
  FROM contract_units
  WHERE estado IN ('VIGENTE', 'GRACIA')
)
SELECT
  a.proyecto_id,
  a.local_id,
  a.numero_contrato AS contrato_a,
  b.numero_contrato AS contrato_b,
  a.fecha_inicio AS fecha_inicio_a,
  a.fecha_fin_efectiva AS fecha_fin_a,
  b.fecha_inicio AS fecha_inicio_b,
  b.fecha_fin_efectiva AS fecha_fin_b
FROM normalized a
JOIN normalized b
  ON a.proyecto_id = b.proyecto_id
 AND a.local_id = b.local_id
 AND a.contrato_id < b.contrato_id
 AND a.fecha_inicio < b.fecha_fin_efectiva
 AND b.fecha_inicio < a.fecha_fin_efectiva
ORDER BY a.proyecto_id, a.local_id, a.numero_contrato, b.numero_contrato;
