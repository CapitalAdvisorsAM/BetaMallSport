export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getRequiredProjectIdSearchParam, withNormalizedProjectId } from "@/lib/http/request";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { zoneSchema } from "@/lib/zones/schema";
import { createZone, listZonesByProject } from "@/lib/zones/zone-service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const projectId = getRequiredProjectIdSearchParam(searchParams);

    const zones = await listZonesByProject(projectId);
    return NextResponse.json(zones);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const result = zoneSchema.safeParse(withNormalizedProjectId(await request.json()));
    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0]?.message ?? "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const created = await createZone(result.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
