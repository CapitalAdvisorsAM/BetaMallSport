import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  required,
  error,
  helperText,
  children,
  className,
}: FormFieldProps): JSX.Element {
  const errorId = `${htmlFor}-error`;
  const helperId = `${htmlFor}-helper`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const child = React.Children.only(children) as React.ReactElement;

  const enhanced = React.cloneElement(child, {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </Label>
      {enhanced}
      {error ? (
        <p id={errorId} role="alert" className="mt-0.5 text-xs text-rose-600">
          {error}
        </p>
      ) : null}
      {helperText && !error ? (
        <p id={helperId} className="mt-0.5 text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
