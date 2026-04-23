"use client";

import { useRouter, useSearchParams } from "next/navigation";

type TenantsPeriodPickerProps = {
  currentPeriodo: string;
};

export function TenantsPeriodPicker({ currentPeriodo }: TenantsPeriodPickerProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periodo", value);
    params.set("page", "1");
    params.delete("detalle");
    router.push(`/plan/tenants?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="periodo-tenants" className="whitespace-nowrap text-slate-600">
        Período
      </label>
      <input
        id="periodo-tenants"
        type="month"
        value={currentPeriodo}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}
