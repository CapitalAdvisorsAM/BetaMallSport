import { beforeEach, describe, expect, it, vi } from "vitest";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const VALID_LINE_KEY = "eerr.gastos.electricidad-compra";

const {
  requireSessionMock,
  requireWriteAccessMock,
  listNotesMock,
  createNoteMock,
  prismaMock
} = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  requireWriteAccessMock: vi.fn(),
  listNotesMock: vi.fn(),
  createNoteMock: vi.fn(),
  prismaMock: {
    project: { findFirst: vi.fn() }
  }
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock,
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/notes/note-query-service", () => ({
  listNotes: listNotesMock,
  serializeNote: (note: unknown) => note
}));

vi.mock("@/lib/notes/note-command-service", () => ({
  createNote: createNoteMock
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

function postRequest(body: unknown, projectId: string = PROJECT_ID) {
  return new Request(`http://localhost/api/notes?projectId=${projectId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("GET /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ user: { id: USER_ID, role: "ADMIN" } });
    prismaMock.project.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id
    }));
    listNotesMock.mockResolvedValue([]);
  });

  it("returns 400 when projectId is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/notes"));
    expect(response.status).toBe(400);
    expect(listNotesMock).not.toHaveBeenCalled();
  });

  it("returns 400 when lineKey filter is invalid", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(`http://localhost/api/notes?projectId=${PROJECT_ID}&lineKey=FOO`)
    );
    expect(response.status).toBe(400);
    expect(listNotesMock).not.toHaveBeenCalled();
  });

  it("returns 200 with the list of notes", async () => {
    listNotesMock.mockResolvedValue([{ id: "n1" }]);
    const { GET } = await import("./route");
    const response = await GET(
      new Request(`http://localhost/api/notes?projectId=${PROJECT_ID}`)
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: [{ id: "n1" }] });
  });

  it("forwards the view, lineKey and status filters", async () => {
    const { GET } = await import("./route");
    await GET(
      new Request(
        `http://localhost/api/notes?projectId=${PROJECT_ID}&view=EERR&lineKey=${VALID_LINE_KEY}&status=OPEN`
      )
    );
    expect(listNotesMock).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      view: "EERR",
      lineKey: VALID_LINE_KEY,
      status: "OPEN"
    });
  });
});

describe("POST /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWriteAccessMock.mockResolvedValue({ user: { id: USER_ID, role: "ADMIN" } });
    prismaMock.project.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id
    }));
    createNoteMock.mockResolvedValue({ id: "n1" });
  });

  it("returns 400 when payload is invalid", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postRequest({ projectId: PROJECT_ID, lineKey: "FOO", view: "EERR", body: "x" })
    );
    expect(response.status).toBe(400);
    expect(createNoteMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body is empty", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postRequest({ projectId: PROJECT_ID, lineKey: VALID_LINE_KEY, view: "EERR", body: "   " })
    );
    expect(response.status).toBe(400);
  });

  it("creates the note and returns 201", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      postRequest({ projectId: PROJECT_ID, lineKey: VALID_LINE_KEY, view: "EERR", body: "Subió 8%" })
    );
    expect(response.status).toBe(201);
    expect(createNoteMock).toHaveBeenCalledWith({
      payload: {
        projectId: PROJECT_ID,
        lineKey: VALID_LINE_KEY,
        view: "EERR",
        body: "Subió 8%"
      },
      userId: USER_ID
    });
  });
});
