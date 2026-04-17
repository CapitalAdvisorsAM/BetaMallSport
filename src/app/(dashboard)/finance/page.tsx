import { redirect } from "next/navigation";

export default function FinancePage(): never {
  redirect("/finance/dashboard");
}
