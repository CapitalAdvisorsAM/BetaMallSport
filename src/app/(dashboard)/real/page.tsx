import { redirect } from "next/navigation";

export default function RealIndexPage(): never {
  redirect("/real/dashboard");
}
