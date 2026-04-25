import { redirect } from "next/navigation";

export default function PlanIndexPage(): never {
  redirect("/plan/dashboard");
}
