import { POST as contratosApplyPost } from "@/app/api/rent-roll/upload/contratos/apply/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return contratosApplyPost(request);
}
