import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { getFinanceProjectId } from "@/lib/real/api-params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const accounts = await prisma.chartOfAccount.findMany({
      where: { projectId },
      orderBy: [
        { displayOrder: "asc" },
        { group1: "asc" },
        { group3: "asc" }
      ]
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}
