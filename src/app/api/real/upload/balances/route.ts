import { DataUploadType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFormFieldValue } from "@/lib/real/api-params";
import { parseBalances } from "@/lib/real/parse-balances";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHUNK_SIZE = 500;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = getFormFieldValue(formData, ["projectId", "proyectoId"]);

    if (!file || !projectId) throw new ApiError(400, "Se requiere archivo y projectId.");
    if (file.size > 20 * 1024 * 1024) throw new ApiError(400, "El archivo no puede superar 20 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseBalances(buffer);

    if (parsed.rows.length === 0 && parsed.unrecognized.length === 0) {
      throw new ApiError(400, "La hoja no contiene filas procesables.");
    }

    const uniquePeriods = [...new Set(parsed.rows.map((row) => row.period.toISOString()))].map((iso) => new Date(iso));

    let inserted = 0;
    if (parsed.rows.length > 0) {
      await prisma.$transaction(async (tx) => {
        if (uniquePeriods.length > 0) {
          await tx.balanceRecord.deleteMany({
            where: { projectId, period: { in: uniquePeriods } }
          });
        }

        for (let index = 0; index < parsed.rows.length; index += CHUNK_SIZE) {
          const chunk = parsed.rows.slice(index, index + CHUNK_SIZE).map((row) => ({
            projectId,
            period: row.period,
            accountCode: row.accountCode,
            accountName: row.accountName,
            accountNameAlt: row.accountNameAlt || null,
            debitsClp: new Prisma.Decimal(row.debitsClp),
            creditsClp: new Prisma.Decimal(row.creditsClp),
            debtorClp: new Prisma.Decimal(row.debtorClp),
            creditorClp: new Prisma.Decimal(row.creditorClp),
            assetClp: new Prisma.Decimal(row.assetClp),
            liabilityClp: new Prisma.Decimal(row.liabilityClp),
            lossesClp: new Prisma.Decimal(row.lossesClp),
            gainsClp: new Prisma.Decimal(row.gainsClp),
            diffClp: new Prisma.Decimal(row.diffClp),
            category: row.category,
            groupName: row.groupName,
            valueUf: new Prisma.Decimal(row.valueUf)
          }));
          const result = await tx.balanceRecord.createMany({ data: chunk, skipDuplicates: true });
          inserted += result.count;
        }
      });
    }

    await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.BALANCES,
        userId: session.user.id,
        fileName: file.name,
        fileUrl: "",
        recordsLoaded: inserted,
        status: "OK",
        errorDetail:
          parsed.unrecognized.length > 0
            ? ({ unrecognized: parsed.unrecognized, summary: parsed.summary } as object)
            : undefined
      }
    });
    invalidateMetricsCacheByProject(projectId);

    return NextResponse.json({
      recordsInserted: inserted,
      unrecognized: parsed.unrecognized,
      summary: {
        total: parsed.summary.total,
        periodos: parsed.summary.periods
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
