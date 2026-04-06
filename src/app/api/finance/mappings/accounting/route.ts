import { NextRequest, NextResponse } from "next/server";
import {
  accountingMappingSchema,
  getActiveUnits,
  getAccountingMappings,
  upsertAccountingMapping
} from "@/lib/finance/mappings";
import { getFinanceProjectId } from "@/lib/finance/api-params";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function normalizeBody(record: Record<string, unknown>) {
  const projectId =
    typeof record.projectId === "string"
      ? record.projectId
      : typeof record.proyectoId === "string"
        ? record.proyectoId
        : "";
  const externalUnit =
    typeof record.externalUnit === "string"
      ? record.externalUnit
      : typeof record.localExterno === "string"
        ? record.localExterno
        : "";
  const unitId =
    typeof record.unitId === "string"
      ? record.unitId
      : typeof record.localId === "string"
        ? record.localId
        : "";

  return {
    projectId,
    externalUnit,
    unitId
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const [accountingMappings, units] = await Promise.all([
      getAccountingMappings(projectId),
      getActiveUnits(projectId)
    ]);

    return NextResponse.json({
      accountingMappings,
      units,
      mapeos: accountingMappings,
      locales: units
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const body = (await req.json()) as Record<string, unknown>;
    const result = accountingMappingSchema.safeParse(normalizeBody(body));
    if (!result.success) {
      throw new ApiError(400, "Datos invalidos.");
    }

    const mapping = await upsertAccountingMapping(result.data, session.user.id);
    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "id requerido.");
    }

    await prisma.accountingUnitMapping.delete({ where: { id } });
    return NextResponse.json({ message: "Eliminado." });
  } catch (error) {
    return handleApiError(error);
  }
}
