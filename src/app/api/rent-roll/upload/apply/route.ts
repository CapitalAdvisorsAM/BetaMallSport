import { POST as contratosApplyPost } from "@/app/api/rent-roll/upload/contratos/apply/route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return contratosApplyPost(request);
}
