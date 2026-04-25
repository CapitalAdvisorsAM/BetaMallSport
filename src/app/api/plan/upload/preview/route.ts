import { POST as contratosPreviewPost } from "@/app/api/plan/upload/contracts/preview/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return contratosPreviewPost(request);
}
