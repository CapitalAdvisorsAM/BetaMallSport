import { POST as contratosApplyPost } from "@/app/api/plan/upload/contracts/apply/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return contratosApplyPost(request);
}
