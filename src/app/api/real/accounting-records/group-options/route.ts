export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { AccountingScenario } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) throw new ApiError(400, "projectId es obligatorio.");

    const rawScenario = searchParams.get("scenario");
    const scenario =
      rawScenario === "PPTO" ? AccountingScenario.PPTO : AccountingScenario.REAL;

    const pairs = await prisma.accountingRecord.groupBy({
      by: ["group1", "group3"],
      where: { projectId, scenario },
      orderBy: [{ group1: "asc" }, { group3: "asc" }],
    });

    const group1Set = new Set<string>();
    const group3ByGroup1: Record<string, string[]> = {};

    for (const pair of pairs) {
      group1Set.add(pair.group1);
      if (!group3ByGroup1[pair.group1]) group3ByGroup1[pair.group1] = [];
      group3ByGroup1[pair.group1].push(pair.group3);
    }

    return NextResponse.json({
      group1: Array.from(group1Set),
      group3ByGroup1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
