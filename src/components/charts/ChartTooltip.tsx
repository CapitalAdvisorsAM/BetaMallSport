"use client";

import { chartColors } from "@/lib/charts/theme";
import { cn } from "@/lib/utils";

type ChartTooltipValue = number | string | Array<number | string> | null | undefined;

type ChartTooltipEntry = {
  value?: ChartTooltipValue;
  name?: string | number;
  dataKey?: string | number;
  color?: string;
  payload?: unknown;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: unknown;
  valueFormatter?: (value: ChartTooltipValue, name: string | number | undefined, entry?: unknown) => string;
  labelFormatter?: (label: unknown) => string;
  className?: string;
};

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
  className,
}: ChartTooltipProps): JSX.Element | null {
  if (!active || !payload?.length) return null;

  const formattedLabel =
    label !== undefined && label !== null
      ? labelFormatter
        ? labelFormatter(label)
        : String(label)
      : null;

  return (
    <div
      className={cn(
        "rounded-md border border-slate-200/60 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm",
        className
      )}
      style={{ color: chartColors.text }}
    >
      {formattedLabel ? (
        <p className="mb-1 font-semibold text-brand-700">{formattedLabel}</p>
      ) : null}
      <ul className="space-y-0.5">
        {payload.map((entry, i) => {
          const value = entry.value;
          const name = entry.name;
          const display = valueFormatter
            ? valueFormatter(value, name, entry.payload)
            : String(value ?? "");
          return (
            <li
              key={`${String(entry.dataKey ?? name ?? i)}-${i}`}
              className="flex items-center gap-2"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {name !== undefined && name !== null ? (
                <span className="text-slate-600">{String(name)}:</span>
              ) : null}
              <span className="font-mono font-medium text-slate-800">{display}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
