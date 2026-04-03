"use client";

import { Input } from "@/components/ui/input";

type ProjectPeriodToolbarProps = {
  desde: string;
  hasta: string;
  onDesdeChange: (value: string) => void;
  onHastaChange: (value: string) => void;
};

export function ProjectPeriodToolbar({
  desde,
  hasta,
  onDesdeChange,
  onHastaChange
}: ProjectPeriodToolbarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="font-medium text-slate-600" htmlFor="periodo-desde">
        Desde
      </label>
      <Input
        id="periodo-desde"
        type="month"
        value={desde}
        onChange={(event) => onDesdeChange(event.target.value)}
        className="w-auto min-w-[150px]"
      />
      <label className="font-medium text-slate-600" htmlFor="periodo-hasta">
        Hasta
      </label>
      <Input
        id="periodo-hasta"
        type="month"
        value={hasta}
        onChange={(event) => onHastaChange(event.target.value)}
        className="w-auto min-w-[150px]"
      />
    </div>
  );
}
