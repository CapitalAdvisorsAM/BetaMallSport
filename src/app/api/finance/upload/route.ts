export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { POST as accountingUploadPOST } from "@/app/api/finance/upload/accounting/route";

// Canonical single upload endpoint keeps backward behavior by delegating to accounting upload.
export async function POST(request: Request): Promise<Response> {
  return accountingUploadPOST(request as Parameters<typeof accountingUploadPOST>[0]);
}
