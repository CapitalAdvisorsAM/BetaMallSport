import { DataUploadType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFormFieldValue } from "@/lib/real/api-params";
import { parseExpenseBudget } from "@/lib/real/parse-expense-budget";
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
    if (file.size > 10 * 1024 * 1024) throw new ApiError(400, "El archivo no puede superar 10 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseExpenseBudget(buffer);

    if (parsed.rows.length === 0 && parsed.unrecognized.length === 0) {
      throw new ApiError(400, "La hoja no contiene filas procesables.");
    }

    const uniquePeriods = [...new Set(parsed.rows.map((row) => row.periodo.toISOString()))].map(
      (iso) => new Date(iso)
    );

    let inserted = 0;
    if (parsed.rows.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          if (uniquePeriods.length > 0) {
            await tx.expenseBudget.deleteMany({
              where: { projectId, periodo: { in: uniquePeriods } }
            });
          }

          for (let index = 0; index < parsed.rows.length; index += CHUNK_SIZE) {
            const chunk = parsed.rows.slice(index, index + CHUNK_SIZE).map((row) => ({
              projectId,
              periodo: row.periodo,
              grupo1: row.grupo1,
              grupo3: row.grupo3,
              valorUf: new Prisma.Decimal(row.valorUf)
            }));
            const result = await tx.expenseBudget.createMany({ data: chunk, skipDuplicates: true });
            inserted += result.count;
          }
        },
        { timeout: 60_000 }
      );
    }

    await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.EXPENSE_BUDGET,
        userId: session.user.id,
        fileName: file.name,
        fileUrl: "",
        recordsLoaded: inserted,
        status: "OK",
        errorDetail:
          parsed.unrecognized.length > 0
            ? ({
                unrecognized: parsed.unrecognized,
                summary: parsed.summary
              } as object)
            : undefined
      }
    });
    invalidateMetricsCacheByProject(projectId);

    return NextResponse.json({
      recordsInserted: inserted,
      unrecognized: parsed.unrecognized,
      summary: parsed.summary
    });
  } catch (error) {
    return handleApiError(error);
  }
}
