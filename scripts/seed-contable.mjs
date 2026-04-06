// Script: seed-contable.mjs
// Carga la hoja "Data Contable" del CDG directamente a la DB sin pasar por la UI
// Uso: node scripts/seed-contable.mjs [ruta-del-archivo]
//
// Ejemplo:
//   node scripts/seed-contable.mjs "G:/Shared drives/CA/FI CA Rentas Comerciales/13. Mall Sport/03. CDG/03. Gestión/20260326 CDG Mall Sport Final v43.xlsx"

import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const PROYECTO_ID = "befc6344-a1f1-48b4-a7ff-7d7747baddb0";
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"; // seed user

const prisma = new PrismaClient();

function serialToDate(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function extractLocalCodigo(raw) {
  const match = /\[L(\d+)\]/i.exec(raw);
  if (match) return match[1];
  const numMatch = /^(\d+)$/.exec(String(raw).trim());
  return numMatch ? numMatch[1] : String(raw).trim();
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
    console.error("Uso: node scripts/seed-contable.mjs <ruta-excel>");
    process.exit(1);
  }

  console.log(`\n📂 Leyendo solo hoja "Data Contable" de: ${filePath}`);

  // Leer solo la hoja necesaria para no reventar la RAM con el CDG completo
  const wb = XLSX.readFile(filePath, {
    sheets: ["Data Contable", "Maestro"],
    cellDates: false,
    dense: false
  });

  const sheetName = wb.SheetNames.find(
    (n) => n.toLowerCase() === "data contable" || n.toLowerCase() === "maestro"
  );

  if (!sheetName) {
    console.error(`❌ Hoja no encontrada. Hojas disponibles: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
  console.log(`✅ Hoja encontrada: "${sheetName}"`);

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  console.log(`   Filas totales: ${rows.length}`);

  // Filtrar Ce.coste = "Real"
  const filas = rows.filter((r) => str(r["Ce.coste"]).toLowerCase() === "real");
  console.log(`   Filas Ce.coste=Real: ${filas.length}`);

  if (filas.length === 0) {
    console.error("❌ No hay filas con Ce.coste = 'Real'. Verificar columnas del archivo.");
    console.log("   Columnas disponibles:", Object.keys(rows[0] ?? {}).join(", "));
    process.exit(1);
  }

  // Cargar locales del proyecto
  const locales = await prisma.local.findMany({
    where: { proyectoId: PROYECTO_ID },
    select: { id: true, codigo: true, nombre: true }
  });
  console.log(`\n🏬 Locales en BD: ${locales.length}`);

  // Mapeos existentes
  const mapeosExistentes = await prisma.mapeoLocalContable.findMany({
    where: { proyectoId: PROYECTO_ID },
    select: { localExterno: true, localId: true }
  });
  const mapeoMap = new Map(mapeosExistentes.map((m) => [m.localExterno, m.localId]));
  console.log(`   Mapeos existentes: ${mapeoMap.size}`);

  // Contratos vigentes para obtener arrendatarioId
  const contratos = await prisma.contrato.findMany({
    where: { proyectoId: PROYECTO_ID, estado: { in: ["VIGENTE", "GRACIA"] } },
    select: { localId: true, arrendatarioId: true }
  });
  const arrendatarioPorLocal = new Map(contratos.map((c) => [c.localId, c.arrendatarioId]));

  // Códigos únicos
  const codigosUnicos = [...new Set(
    filas.map((r) => extractLocalCodigo(str(r["Local"] ?? "")))
    .filter(Boolean)
  )];

  const sinMapeo = [];
  const nuevosMapeos = [];

  for (const codigo of codigosUnicos) {
    if (mapeoMap.has(codigo)) continue;

    const exacto = locales.find((l) => l.codigo === codigo || l.codigo === `L${codigo}`);
    if (exacto) {
      mapeoMap.set(codigo, exacto.id);
      nuevosMapeos.push({ proyectoId: PROYECTO_ID, localExterno: codigo, localId: exacto.id, creadoPor: SYSTEM_USER_ID });
      continue;
    }

    const arrendatarioNombre = filas.find((r) => extractLocalCodigo(str(r["Local"] ?? "")) === codigo)
      ?.["Arrendatario"] ?? "";
    const scored = locales
      .map((l) => ({
        ...l,
        score: Math.max(similarity(str(arrendatarioNombre), l.nombre), similarity(codigo, l.codigo))
      }))
      .sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score >= 0.75) {
      mapeoMap.set(codigo, scored[0].id);
      nuevosMapeos.push({ proyectoId: PROYECTO_ID, localExterno: codigo, localId: scored[0].id, creadoPor: SYSTEM_USER_ID });
    } else {
      sinMapeo.push({ codigo, arrendatario: str(arrendatarioNombre), mejor: scored[0]?.nombre, score: scored[0]?.score?.toFixed(2) });
    }
  }

  if (nuevosMapeos.length > 0) {
    await prisma.mapeoLocalContable.createMany({ data: nuevosMapeos, skipDuplicates: true });
    console.log(`\n🔗 Mapeos nuevos creados: ${nuevosMapeos.length}`);
  }

  if (sinMapeo.length > 0) {
    console.log(`\n⚠️  Sin mapeo (${sinMapeo.length}):`);
    sinMapeo.forEach((s) => console.log(`   [${s.codigo}] ${s.arrendatario} → mejor: ${s.mejor} (${s.score})`));
  }

  // Construir registros
  const registros = [];
  const periodos = new Set();

  for (const row of filas) {
    const localCodigo = extractLocalCodigo(str(row["Local"] ?? ""));
    const localId = mapeoMap.get(localCodigo);
    if (!localId) continue;

    const mesRaw = row["Mes"];
    if (!mesRaw) continue;
    const mes = typeof mesRaw === "number" ? serialToDate(mesRaw) : new Date(String(mesRaw));
    if (isNaN(mes.getTime())) continue;

    const grupo1 = str(row["GRUPO 1"]);
    if (!grupo1) continue;

    periodos.add(mes.toISOString().slice(0, 7));

    registros.push({
      proyectoId: PROYECTO_ID,
      localId,
      arrendatarioId: arrendatarioPorLocal.get(localId) ?? null,
      periodo: mes,
      grupo1,
      grupo3: str(row["GRUPO 3"]),
      denominacion: str(row["Denominación objeto"] ?? row["Denominacion objeto"] ?? ""),
      valorUf: num(row["Valor UF"]),
      categoriaTamano: str(row["Categoría (Tamaño)"] ?? row["Categoria (Tamano)"] ?? "") || null,
      categoriaTipo: str(row["Categoría (Tipo)"] ?? row["Categoria (Tipo)"] ?? "") || null,
      piso: str(row["Piso"] ?? "") || null
    });
  }

  console.log(`\n📊 Registros a insertar: ${registros.length}`);
  console.log(`   Períodos: ${[...periodos].sort().join(", ")}`);

  if (registros.length === 0) {
    console.error("❌ No hay registros válidos para insertar.");
    process.exit(1);
  }

  // Borrar datos existentes de los mismos períodos y reinsertar
  for (const periodoStr of periodos) {
    const periodoDate = new Date(`${periodoStr}-01`);
    const deleted = await prisma.registroContable.deleteMany({
      where: { proyectoId: PROYECTO_ID, periodo: periodoDate }
    });
    if (deleted.count > 0) console.log(`   🗑️  Período ${periodoStr}: ${deleted.count} registros reemplazados`);
  }

  const result = await prisma.registroContable.createMany({ data: registros, skipDuplicates: true });
  console.log(`\n✅ Insertados: ${result.count} registros`);

  // Registrar en historial
  await prisma.cargaDatos.create({
    data: {
      proyectoId: PROYECTO_ID,
      tipo: "CONTABLE",
      usuarioId: SYSTEM_USER_ID,
      archivoNombre: filePath.split(/[/\\]/).pop(),
      archivoUrl: "",
      registrosCargados: result.count,
      estado: "OK",
      errorDetalle: sinMapeo.length > 0 ? { sinMapeo } : undefined
    }
  });

  console.log(`\n🎉 Listo. Recarga el módulo EE.RR en el navegador.\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
