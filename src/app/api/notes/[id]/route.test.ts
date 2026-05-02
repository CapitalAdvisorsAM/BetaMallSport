import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const NOTE_ID = "33333333-3333-3333-3333-333333333333";
const USER_ID = "22222222-2222-2222-2222-222222222222";

const {
  requireWriteAccessMock,
  updateNoteMock,
  softDeleteNoteMock,
  prismaMock
} = vi.hoisted(() => ({
  requireWriteAccessMock: vi.fn(),
  updateNoteMock: vi.fn(),
  softDeleteNoteMock: vi.fn(),
  prismaMock: {
    project: { findFirst: vi.fn() }
  }
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: vi.fn(),
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/notes/note-query-service", () => ({
  serializeNote: (note: unknown) => note
}));

vi.mock("@/lib/notes/note-command-service", () => ({
  updateNote: updateNoteMock,
  softDeleteNote: softDeleteNoteMock
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

function putRequest(body: unknown) {
  return new Request(`http://localhost/api/notes/${NOTE_ID}?projectId=${PROJECT_ID}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function deleteRequest() {
  return new Request(`http://localhost/api/notes/${NOTE_ID}?projectId=${PROJECT_ID}`, {
    method: "DELETE"
  });
}

const ctx = { params: { id: NOTE_ID } };

beforeEach(() => {
  vi.clearAllMocks();
  requireWriteAccessMock.mockResolvedValue({ user: { id: USER_ID, role: "ADMIN" } });
  prismaMock.project.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id
  }));
});

describe("PUT /api/notes/[id]", () => {
  it("returns 400 when payload has neither body nor status", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(putRequest({}), ctx);
    expect(response.status).toBe(400);
    expect(updateNoteMock).not.toHaveBeenCalled();
  });

  it("returns 200 and forwards the body update", async () => {
    updateNoteMock.mockResolvedValue({ id: NOTE_ID, body: "edited" });
    const { PUT } = await import("./route");
    const response = await PUT(putRequest({ body: "edited" }), ctx);
    expect(response.status).toBe(200);
    expect(updateNoteMock).toHaveBeenCalledWith({
      id: NOTE_ID,
      projectId: PROJECT_ID,
      payload: { body: "edited" },
      session: expect.objectContaining({ user: expect.any(Object) })
    });
  });

  it("forwards a status change", async () => {
    updateNoteMock.mockResolvedValue({ id: NOTE_ID, status: "RESOLVED" });
    const { PUT } = await import("./route");
    const response = await PUT(putRequest({ status: "RESOLVED" }), ctx);
    expect(response.status).toBe(200);
    expect(updateNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { status: "RESOLVED" } })
    );
  });

  it("returns 403 when the command service rejects", async () => {
    const { ApiError } = await import("@/lib/api-error");
    updateNoteMock.mockRejectedValue(new ApiError(403, "Sin permisos."));
    const { PUT } = await import("./route");
    const response = await PUT(putRequest({ body: "x" }), ctx);
    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/notes/[id]", () => {
  it("returns 204 on success", async () => {
    softDeleteNoteMock.mockResolvedValue(undefined);
    const { DELETE } = await import("./route");
    const response = await DELETE(deleteRequest(), ctx);
    expect(response.status).toBe(204);
    expect(softDeleteNoteMock).toHaveBeenCalledWith({
      id: NOTE_ID,
      projectId: PROJECT_ID,
      session: expect.objectContaining({ user: expect.any(Object) })
    });
  });

  it("returns 404 when the note is missing", async () => {
    const { ApiError } = await import("@/lib/api-error");
    softDeleteNoteMock.mockRejectedValue(new ApiError(404, "Nota no encontrada."));
    const { DELETE } = await import("./route");
    const response = await DELETE(deleteRequest(), ctx);
    expect(response.status).toBe(404);
  });
});
