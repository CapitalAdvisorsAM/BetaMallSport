import { DataUploadType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFormFieldValue } from "@/lib/finance/api-params";
import { parseBank } from "@/lib/finance/parse-bank";
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
    const parsed = parseBank(buffer);

    if (parsed.rows.length === 0 && parsed.unrecognized.length === 0) {
      throw new ApiError(400, "La hoja no contiene filas procesables.");
    }

    const uniqueDates = [...new Set(parsed.rows.map((row) => row.accountingDate.toISOString()))].map((iso) => new Date(iso));

    let inserted = 0;
    if (parsed.rows.length > 0) {
      await prisma.$transaction(async (tx) => {
        if (uniqueDates.length > 0) {
          await tx.bankMovement.deleteMany({
            where: { projectId, accountingDate: { in: uniqueDates } }
          });
        }

        for (let index = 0; index < parsed.rows.length; index += CHUNK_SIZE) {
          const chunk = parsed.rows.slice(index, index + CHUNK_SIZE).map((row) => ({
            projectId,
            period: row.period,
            accountingDate: row.accountingDate,
            account: row.account,
            movement: row.movement,
            operationNumber: row.operationNumber || null,
            amountClp: new Prisma.Decimal(row.amountClp),
            originRut: row.originRut || null,
            originName: row.originName || null,
            transferComment: row.transferComment || null,
            bank: row.bank,
            classification: row.classification
          }));
          const result = await tx.bankMovement.createMany({ data: chunk, skipDuplicates: true });
          inserted += result.count;
        }
      });
    }

    await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.BANK,
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
