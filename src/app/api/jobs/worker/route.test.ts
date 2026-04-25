import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireWriteAccessMock,
  listQueuedJobsMock,
  getJobMock,
  updateJobStatusMock,
  runContratosApplyJobMock
} = vi.hoisted(() => ({
  requireWriteAccessMock: vi.fn(),
  listQueuedJobsMock: vi.fn(),
  getJobMock: vi.fn(),
  updateJobStatusMock: vi.fn(),
  runContratosApplyJobMock: vi.fn()
}));

vi.mock("@/lib/permissions", () => ({
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/jobs", () => ({
  listQueuedJobs: listQueuedJobsMock,
  getJob: getJobMock,
  updateJobStatus: updateJobStatusMock
}));

vi.mock("@/lib/plan/contracts-apply-job", () => ({
  runContratosApplyJob: runContratosApplyJobMock
}));

describe("POST /api/jobs/worker", () => {
  beforeEach(() => {
    requireWriteAccessMock.mockResolvedValue({ user: { id: "u1" } });
    listQueuedJobsMock.mockReset();
    getJobMock.mockReset();
    updateJobStatusMock.mockReset();
    runContratosApplyJobMock.mockReset();
  });

  it("returns no jobs message when queue is empty", async () => {
    listQueuedJobsMock.mockResolvedValue([]);
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/jobs/worker", { method: "POST" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 0,
      message: "No hay jobs en cola."
    });
  });

  it("processes queued contratos apply job", async () => {
    listQueuedJobsMock.mockResolvedValue([{ id: "job-1" }]);
    getJobMock.mockResolvedValue({
      id: "job-1",
      kind: "UPLOAD_CONTRATOS_APPLY",
      userId: "u1",
      payload: {
        input: { cargaId: "c1" }
      }
    });
    runContratosApplyJobMock.mockResolvedValue({
      cargaId: "c1",
      report: { created: 1, updated: 0, skipped: 0, rejected: 0, rejectedRows: [] }
    });

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/jobs/worker", { method: "POST" }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { processed: number; outputs: Array<{ status: string }> };
    expect(body.processed).toBe(1);
    expect(body.outputs[0]?.status).toBe("SUCCEEDED");
    expect(updateJobStatusMock).toHaveBeenCalled();
  });
});
