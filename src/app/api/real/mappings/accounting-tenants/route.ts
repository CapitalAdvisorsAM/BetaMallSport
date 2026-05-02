import { NextRequest, NextResponse } from "next/server";
import {
  accountingTenantMappingSchema,
  getAccountingTenantMappings,
  getActiveTenants,
  upsertAccountingTenantMapping
} from "@/lib/real/mappings";
import { getFinanceProjectId } from "@/lib/real/api-params";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeBody(record: Record<string, unknown>) {
  const projectId =
    typeof record.projectId === "string"
      ? record.projectId
      : typeof record.proyectoId === "string"
        ? record.proyectoId
        : "";
  const externalTenant =
    typeof record.externalTenant === "string"
      ? record.externalTenant
      : typeof record.arrendatarioExterno === "string"
        ? record.arrendatarioExterno
        : "";
  const tenantId =
    typeof record.tenantId === "string"
      ? record.tenantId
      : typeof record.arrendatarioId === "string"
        ? record.arrendatarioId
        : "";

  return { projectId, externalTenant, tenantId };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const [mappings, tenants] = await Promise.all([
      getAccountingTenantMappings(projectId),
      getActiveTenants(projectId)
    ]);

    return NextResponse.json({ mappings, tenants });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const body = (await req.json()) as Record<string, unknown>;
    const result = accountingTenantMappingSchema.safeParse(normalizeBody(body));
    if (!result.success) {
      throw new ApiError(400, result.error.issues[0]?.message ?? "Datos invalidos.");
    }

    const mapping = await upsertAccountingTenantMapping(result.data, session.user.id);
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

    await prisma.accountingTenantMapping.delete({ where: { id } });
    return NextResponse.json({ message: "Eliminado." });
  } catch (error) {
    return handleApiError(error);
  }
}
