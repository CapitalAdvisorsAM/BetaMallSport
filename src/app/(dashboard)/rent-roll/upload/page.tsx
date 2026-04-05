import { redirect } from "next/navigation";

export default function RentRollUploadPage(): never {
  redirect("/rent-roll/units?seccion=upload");
}
