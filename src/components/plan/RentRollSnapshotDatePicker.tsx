"use client";

import { useMemo, useState, useTransition } from "react";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatDateParamLocal,
  parseDateParamLocal
} from "@/lib/plan/snapshot-date";
import { cn, formatDate } from "@/lib/utils";

type RentRollSnapshotDatePickerProps = {
  projectId: string;
  selectedDate: string;
};

export function RentRollSnapshotDatePicker({
  projectId,
  selectedDate
}: RentRollSnapshotDatePickerProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedValue = useMemo(() => parseDateParamLocal(selectedDate), [selectedDate]);

  const handleSelect = (nextDate?: Date): void => {
    if (!nextDate) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("project", projectId);
    params.set("fecha", formatDateParamLocal(nextDate));
    params.delete("periodo");

    setOpen(false);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">Fecha snapshot</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[280px] justify-start rounded-md text-left font-medium",
              isPending ? "opacity-70" : ""
            )}
          >
            <CalendarIcon data-icon="inline-start" />
            {formatDate(selectedValue)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedValue}
            onSelect={handleSelect}
            locale={es}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
