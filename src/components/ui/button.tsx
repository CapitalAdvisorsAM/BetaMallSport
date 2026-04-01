import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-white",
  {
    variants: {
      variant: {
        default: "bg-brand-500 text-white hover:bg-brand-700 focus-visible:ring-brand-500",
        outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-brand-500",
        secondary: "bg-secondary-500 text-white hover:bg-secondary-700 focus-visible:ring-secondary-500",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-brand-500",
        link: "text-brand-500 underline-offset-4 hover:underline focus-visible:ring-brand-500",
        destructive: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
