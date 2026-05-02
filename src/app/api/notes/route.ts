export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import {
  getRequiredActiveProjectIdFromRequest,
  getRequiredActiveProjectIdSearchParam,
  withCanonicalProjectId
} from "@/lib/http/request";
import { createNote } from "@/lib/notes/note-command-service";
import { listNotes, serializeNote } from "@/lib/notes/note-query-service";
import { noteCreateSchema, noteListQuerySchema } from "@/lib/notes/schema";
import { requireSession, requireWriteAccess } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const projectId = await getRequiredActiveProjectIdSearchParam(searchParams);

    const parsed = noteListQuerySchema.safeParse({
      projectId,
      view: searchParams.get("view") ?? undefined,
      lineKey: searchParams.get("lineKey") ?? undefined,
      status: searchParams.get("status") ?? undefined
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0].message, issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const notes = await listNotes(parsed.data);
    return NextResponse.json({ data: notes.map(serializeNote) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const projectId = await getRequiredActiveProjectIdFromRequest(request);
    const parsed = noteCreateSchema.safeParse(
      withCanonicalProjectId(await request.json(), projectId)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0].message, issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const created = await createNote({ payload: parsed.data, userId: session.user.id });
    return NextResponse.json(serializeNote(created), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
