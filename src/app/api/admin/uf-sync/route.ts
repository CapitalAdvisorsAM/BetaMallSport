export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import {
  UF_CATCHUP_DEFAULT_DAYS,
  UF_CATCHUP_MAX_DAYS,
} from "@/lib/constants";
import { logDuration } from "@/lib/observability";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { fetchUfValue } from "@/lib/uf-sync/cmf-client";

// Límite de backfill para evitar abusos — 365 días por request.
const MAX_BACKFILL_DAYS = 365;

// Configurar Cloud Scheduler (GCP) para llamar este endpoint diariamente:
//
//   gcloud scheduler jobs create http uf-sync-daily \
//     --schedule="10 8 * * *" \
//     --uri="https://TU_APP.run.app/api/admin/uf-sync" \
//     --http-method=POST \
//     --headers="X-Cron-Secret=<CRON_SECRET>,Content-Type=application/json" \
//     --message-body='{}' \
//     --time-zone="America/Santiago" \
//     --location="${GCP_REGION}"
//
// Horario: 8:10 AM hora Santiago — CMF publica el valor UF alrededor de las 8 AM.

async function isAuthorized(request: Request): Promise<boolean> {
  // Modo 1: header X-Cron-Secret (para Cloud Scheduler, sin sesión)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("x-cron-secret") === cronSecret) {
    return true;
  }
  // Modo 2: sesión activa con rol ADMIN
  try {
    const session = await requireSession();
    return session.user.role === "ADMIN";
  } catch {
    return false;
  }
}

function parseDateOnly(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, `Fecha inválida: "${value}". Usar formato YYYY-MM-DD.`);
  }
  // Normalizar a UTC midnight para evitar drift de zona horaria
  return new Date(d.toISOString().slice(0, 10));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function todayUtc(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

type SyncBody = {
  fecha?: string;
  desde?: string;
  hasta?: string;
  modo?: "hoy" | "catchup";
  dias?: number;
};

async function buildCatchupDates(days: number): Promise<Date[]> {
  const today = todayUtc();
  const desde = addDays(today, -(days - 1));
  const existing = await prisma.valorUF.findMany({
    where: { fecha: { gte: desde, lte: today } },
    select: { fecha: true },
  });
  const existingSet = new Set(
    existing.map((row) => row.fecha.toISOString().slice(0, 10))
  );
  const missing: Date[] = [];
  let current = desde;
  while (current <= today) {
    const iso = current.toISOString().slice(0, 10);
    if (!existingSet.has(iso)) missing.push(new Date(current));
    current = addDays(current, 1);
  }
  return missing;
}

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as SyncBody;

    let dates: Date[];
    let mode: "hoy" | "catchup" | "fecha" | "rango";

    if (body.desde !== undefined || body.hasta !== undefined) {
      // Modo backfill: rango de fechas
      const desde = parseDateOnly(body.desde ?? body.hasta!);
      const hasta = parseDateOnly(body.hasta ?? body.desde!);
      if (desde > hasta) {
        throw new ApiError(400, "'desde' no puede ser mayor que 'hasta'.");
      }
      const diffDays =
        Math.round((hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      if (diffDays > MAX_BACKFILL_DAYS) {
        throw new ApiError(400, `El rango no puede superar ${MAX_BACKFILL_DAYS} días.`);
      }
      dates = [];
      let current = desde;
      while (current <= hasta) {
        dates.push(new Date(current));
        current = addDays(current, 1);
      }
      mode = "rango";
    } else if (body.fecha !== undefined) {
      // Modo fecha puntual
      dates = [parseDateOnly(body.fecha)];
      mode = "fecha";
    } else if (body.modo === "hoy") {
      // Modo legacy explícito: solo hoy
      dates = [todayUtc()];
      mode = "hoy";
    } else {
      // Default (body vacío o modo=catchup): catch-up últimos N días — rellena huecos.
      const requested = body.dias ?? UF_CATCHUP_DEFAULT_DAYS;
      if (!Number.isInteger(requested) || requested < 1 || requested > UF_CATCHUP_MAX_DAYS) {
        throw new ApiError(
          400,
          `'dias' debe ser un entero entre 1 y ${UF_CATCHUP_MAX_DAYS}.`
        );
      }
      dates = await buildCatchupDates(requested);
      mode = "catchup";
      if (dates.length === 0) {
        logDuration("uf_sync", startedAt, { synced: 0, skipped: 0, mode, upToDate: true });
        return NextResponse.json({
          synced: 0,
          skipped: 0,
          records: [],
          upToDate: true,
          mode,
        });
      }
    }

    const records: { fecha: string; valor: string }[] = [];
    let skipped = 0;

    for (const fecha of dates) {
      const result = await fetchUfValue(fecha);
      if (!result) {
        skipped++;
        continue;
      }
      await prisma.valorUF.upsert({
        where: { fecha: result.fecha },
        create: { fecha: result.fecha, valor: result.valor },
        update: { valor: result.valor },
      });
      records.push({
        fecha: result.fecha.toISOString().slice(0, 10),
        valor: result.valor.toString(),
      });
    }

    logDuration("uf_sync", startedAt, { synced: records.length, skipped, mode });
    return NextResponse.json({ synced: records.length, skipped, records, mode });
  } catch (error) {
    return handleApiError(error);
  }
}
