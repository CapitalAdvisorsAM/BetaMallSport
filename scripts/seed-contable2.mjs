// seed-contable2.mjs — usa ExcelJS (streaming) para manejar archivos grandes
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const PROYECTO_ID = "befc6344-a1f1-48b4-a7ff-7d7747baddb0";
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

// El CDG ya almacena los valores con signo correcto:
//   - Ingresos y recuperaciones: POSITIVOS
//   - Costos y gastos: NEGATIVOS
// No se requiere ninguna normalización de signo al guardar.

const prisma = new PrismaClient();

function serialToDate(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function extractLocalCodigo(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const match = /\[L(\d+)\]/i.exec(s);
  if (match) return match[1];
  const numMatch = /^(\d+)$/.exec(s);
  return numMatch ? numMatch[1] : s;
}

function cellVal(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object" && cell.value.result !== undefined) return cell.value.result;
  if (typeof cell.value === "object" && cell.value.text !== undefined) return cell.value.text;
  return cell.value;
}

function str(v) { return String(v ?? "").trim(); }
function num(v) {
  const n = parseFloat(String(v ?? "0").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const A = a.toUpperCase(), B = b.toUpperCase();
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return 0;
  const bg = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bg(A), bb = bg(B);
  let inter = 0;
  for (const x of ba) if (bb.has(x)) inter++;
  return (2 * inter) / (ba.size + bb.size);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: node scripts/seed-contable2.mjs <ruta-excel>");
    process.exit(1);
  }

  console.log(`\n📂 Leyendo: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const ws = workbook.getWorksheet("Data Contable") ?? workbook.getWorksheet("Maestro");
  if (!ws) {
    const names = workbook.worksheets.map((s) => s.name).join(", ");
    console.error(`❌ Hoja no encontrada. Disponibles: ${names}`);
    process.exit(1);
  }
  console.log(`✅ Hoja: "${ws.name}"  Filas: ${ws.rowCount}`);

  // Detectar fila de headers (buscar la que tenga "GRUPO 1" o "Mes")
  let headerRow = null;
  let headerIdx = 0;
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (headerRow) return;
    const vals = row.values.map((v) => str(cellVal({ value: v })).toUpperCase());
    if (vals.includes("GRUPO 1") || vals.includes("MES")) {
      headerRow = row;
      headerIdx = rowNum;
    }
  });

  if (!headerRow) {
    console.error("❌ No se encontró fila de headers (GRUPO 1 / Mes)");
    process.exit(1);
  }
  console.log(`   Headers en fila ${headerIdx}`);

  // Mapear nombre de columna → índice (1-based)
  const colIdx = {};
  headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    const key = str(cellVal(cell)).toUpperCase();
    if (key) colIdx[key] = colNum;
  });

  const get = (row, name) => {
    const idx = colIdx[name.toUpperCase()];
    if (!idx) return null;
    return cellVal(row.getCell(idx));
  };

  console.log("   Columnas:", Object.keys(colIdx).join(", "));

  // Cargar locales y mapeos
  const locales = await prisma.local.findMany({
    where: { proyectoId: PROYECTO_ID },
    select: { id: true, codigo: true, nombre: true }
  });
  console.log(`\n🏬 Locales en BD: ${locales.length}`);

  const mapeosExistentes = await prisma.mapeoLocalContable.findMany({
    where: { proyectoId: PROYECTO_ID },
    select: { localExterno: true, localId: true }
  });
  const mapeoMap = new Map(mapeosExistentes.map((m) => [m.localExterno, m.localId]));

  const contratos = await prisma.contrato.findMany({
    where: { proyectoId: PROYECTO_ID, estado: { in: ["VIGENTE", "GRACIA"] } },
    select: { localId: true, arrendatarioId: true }
  });
  const arrendatarioPorLocal = new Map(contratos.map((c) => [c.localId, c.arrendatarioId]));

  // Parsear filas
  const filas = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum <= headerIdx) return;

    const ceCoste = str(get(row, "Ce.coste")).toLowerCase();
    if (ceCoste && ceCoste !== "real") return;

    const mesRaw = get(row, "Mes");
    if (!mesRaw) return;
    let mes;
    if (typeof mesRaw === "number") {
      mes = serialToDate(mesRaw);
    } else if (mesRaw instanceof Date) {
      mes = new Date(Date.UTC(mesRaw.getFullYear(), mesRaw.getMonth(), 1));
    } else {
      mes = new Date(String(mesRaw));
    }
    if (isNaN(mes.getTime())) return;

    const localRaw = str(get(row, "Local") ?? "");
    const localCodigo = extractLocalCodigo(localRaw); // puede ser "" para costos de propiedad

    const grupo1 = str(get(row, "GRUPO 1") ?? "");
    if (!grupo1) return;

    filas.push({
      mes,
      localCodigo,
      arrendatarioNombre: str(get(row, "Arrendatario") ?? ""),
      grupo1,
      grupo3: str(get(row, "GRUPO 3") ?? ""),
      denominacion: str(get(row, "Denominación objeto") ?? get(row, "Denominacion objeto") ?? ""),
      valorUf: num(get(row, "Valor UF")),
      categoriaTamano: str(get(row, "Categoría (Tamaño)") ?? get(row, "Categoria (Tamano)") ?? "") || null,
      categoriaTipo: str(get(row, "Categoría (Tipo)") ?? get(row, "Categoria (Tipo)") ?? "") || null,
      piso: str(get(row, "Piso") ?? "") || null
    });
  });

  console.log(`   Filas Ce.coste=Real: ${filas.length}`);

  if (filas.length === 0) {
    console.error("❌ No hay filas con Ce.coste = 'Real'.");
    process.exit(1);
  }

  // Fuzzy matching de códigos
  const codigosUnicos = [...new Set(filas.map((f) => f.localCodigo))];
  const sinMapeo = [];
  const nuevosMapeos = [];

  for (const codigo of codigosUnicos) {
    // Fila sin local (costo a nivel de propiedad) → guardar con localId=null directamente
    if (!codigo) {
      mapeoMap.set(codigo, null);
      continue;
    }
    if (mapeoMap.has(codigo)) continue;
    const exacto = locales.find((l) => l.codigo === codigo || l.codigo === `L${codigo}`);
    if (exacto) {
      mapeoMap.set(codigo, exacto.id);
      nuevosMapeos.push({ proyectoId: PROYECTO_ID, localExterno: codigo, localId: exacto.id, creadoPor: SYSTEM_USER_ID });
      continue;
    }
    const arrendatarioNombre = filas.find((f) => f.localCodigo === codigo)?.arrendatarioNombre ?? "";
    const scored = locales
      .map((l) => ({ ...l, score: Math.max(similarity(arrendatarioNombre, l.nombre), similarity(codigo, l.codigo)) }))
      .sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score >= 0.75) {
      mapeoMap.set(codigo, scored[0].id);
      nuevosMapeos.push({ proyectoId: PROYECTO_ID, localExterno: codigo, localId: scored[0].id, creadoPor: SYSTEM_USER_ID });
    } else {
      // Mark as property-level (no local match) — will be stored with localId = null
      mapeoMap.set(codigo, null);
      sinMapeo.push({ codigo, arrendatario: arrendatarioNombre, mejor: scored[0]?.nombre, score: scored[0]?.score?.toFixed(2) });
    }
  }

  if (nuevosMapeos.length > 0) {
    await prisma.mapeoLocalContable.createMany({ data: nuevosMapeos, skipDuplicates: true });
    console.log(`\n🔗 Mapeos nuevos: ${nuevosMapeos.length}`);
  }
  if (sinMapeo.length > 0) {
    console.log(`\n⚠️  Sin mapeo (${sinMapeo.length}):`);
    sinMapeo.forEach((s) => console.log(`   [${s.codigo}] ${s.arrendatario} → mejor: ${s.mejor} (${s.score})`));
  }

  // Construir registros
  const registros = [];
  const periodos = new Set();

  for (const fila of filas) {
    if (!mapeoMap.has(fila.localCodigo)) continue; // codigo nunca visto, saltar
    const localId = mapeoMap.get(fila.localCodigo); // puede ser null para costos sin local
    periodos.add(fila.mes.toISOString().slice(0, 7));
    registros.push({
      proyectoId: PROYECTO_ID,
      localId: localId ?? null,
      arrendatarioId: arrendatarioPorLocal.get(localId) ?? null,
      periodo: fila.mes,
      grupo1: fila.grupo1,
      grupo3: fila.grupo3,
      denominacion: fila.denominacion || fila.grupo3,
      valorUf: fila.valorUf, // CDG ya tiene signo correcto
      categoriaTamano: fila.categoriaTamano,
      categoriaTipo: fila.categoriaTipo,
      piso: fila.piso
    });
  }

  // Agregar filas con la misma clave (periodo, grupo1, grupo3, denominacion, localId)
  // para evitar conflictos del índice único parcial cuando hay múltiples transacciones
  // del mismo tipo sin local asignado (costos a nivel propiedad).
  const aggMap = new Map();
  for (const r of registros) {
    const key = `${r.periodo.toISOString()}::${r.grupo1}::${r.grupo3}::${r.denominacion}::${r.localId ?? "null"}`;
    if (aggMap.has(key)) {
      const existing = aggMap.get(key);
      existing.valorUf = Number(existing.valorUf) + Number(r.valorUf);
    } else {
      aggMap.set(key, { ...r, valorUf: Number(r.valorUf) });
    }
  }
  const registrosAgg = [...aggMap.values()];

  console.log(`\n📊 Registros CDG: ${registros.length} → tras agregación: ${registrosAgg.length}`);
  console.log(`   Períodos: ${[...periodos].sort().join(", ")}`);

  if (registrosAgg.length === 0) {
    console.error("❌ 0 registros. Probablemente los locales no matchean. Revisar sin-mapeo arriba.");
    process.exit(1);
  }

  // Reemplazar períodos existentes
  for (const periodoStr of periodos) {
    const deleted = await prisma.registroContable.deleteMany({
      where: { proyectoId: PROYECTO_ID, periodo: new Date(`${periodoStr}-01`) }
    });
    if (deleted.count > 0) console.log(`   🗑️  ${periodoStr}: ${deleted.count} reemplazados`);
  }

  const result = await prisma.registroContable.createMany({ data: registrosAgg, skipDuplicates: false });
  console.log(`\n✅ Insertados: ${result.count} registros`);

  await prisma.cargaDatos.create({
    data: {
      proyectoId: PROYECTO_ID,
      tipo: "CONTABLE",
      usuarioId: SYSTEM_USER_ID,
      archivoNombre: filePath.split(/[/\\]/).pop(),
      archivoUrl: "",
      registrosCargados: registros.length,
      estado: "OK",
      errorDetalle: sinMapeo.length > 0 ? { sinMapeo } : undefined
    }
  });

  console.log(`\n🎉 Listo. Recarga el módulo EE.RR.\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
