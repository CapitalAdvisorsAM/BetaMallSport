export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getRequiredActiveProjectIdFromRequest } from "@/lib/http/request";
import { softDeleteNote, updateNote } from "@/lib/notes/note-command-service";
import { serializeNote } from "@/lib/notes/note-query-service";
import { noteUpdateSchema } from "@/lib/notes/schema";
import { requireWriteAccess } from "@/lib/permissions";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const projectId = await getRequiredActiveProjectIdFromRequest(request);

    const parsed = noteUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0].message, issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = await updateNote({
      id: context.params.id,
      projectId,
      payload: parsed.data,
      session
    });
    return NextResponse.json(serializeNote(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const projectId = await getRequiredActiveProjectIdFromRequest(request);
    await softDeleteNote({ id: context.params.id, projectId, session });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
