"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, getDefaultClassNames, type ChevronProps } from "react-day-picker";
import type { ButtonProps } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: ButtonProps["variant"];
};

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  buttonVariant = "ghost",
  ...props
}: CalendarProps): JSX.Element {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: cn("flex flex-col gap-4", defaultClassNames.months),
        month: cn("flex flex-col gap-4", defaultClassNames.month),
        month_caption: cn(
          "relative flex items-center justify-center pt-1",
          defaultClassNames.month_caption
        ),
        caption_label: cn("text-sm font-semibold text-brand-700", defaultClassNames.caption_label),
        nav: cn("flex items-center gap-1", defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant, size: "icon" }),
          "size-8 border border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-50",
          "absolute left-1",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant, size: "icon" }),
          "size-8 border border-slate-200 bg-white p-0 text-slate-700 hover:bg-slate-50",
          "absolute right-1",
          defaultClassNames.button_next
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "w-9 rounded-md text-[0.8rem] font-medium text-slate-500",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn(
          "relative size-9 p-0 text-center text-sm",
          defaultClassNames.day,
          defaultClassNames.selected,
          defaultClassNames.today,
          defaultClassNames.outside,
          defaultClassNames.disabled,
          defaultClassNames.hidden,
          buttonVariants({ variant: buttonVariant, size: "icon" }),
          "size-9 p-0 font-normal text-slate-700 aria-selected:opacity-100"
        ),
        selected: cn(
          "bg-brand-500 text-white hover:bg-brand-700 hover:text-white focus:bg-brand-700 focus:text-white",
          defaultClassNames.selected
        ),
        today: cn("border border-gold-400 text-brand-700", defaultClassNames.today),
        outside: cn("text-slate-300 aria-selected:bg-brand-100", defaultClassNames.outside),
        disabled: cn("text-slate-300 opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames
      }}
      components={{
        Chevron: ({ orientation, ...iconProps }: ChevronProps) =>
          orientation === "left" ? (
            <ChevronLeftIcon {...iconProps} />
          ) : (
            <ChevronRightIcon {...iconProps} />
          )
      }}
      {...props}
    />
  );
}
