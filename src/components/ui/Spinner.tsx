import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  size?: "sm" | "md";
};

export function Spinner({ className, size = "sm" }: SpinnerProps): JSX.Element {
  return (
    <Loader2
      className={cn("animate-spin", size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5", className)}
    />
  );
}
