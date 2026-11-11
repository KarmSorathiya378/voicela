import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}
/** Pair aria-describedby with `${htmlFor}-description` and/or `${htmlFor}-error`. */
export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { label, htmlFor, hint, error, required, className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required && (
          <span className="ml-1 text-muted-foreground">(required)</span>
        )}
      </label>
      {children}
      {hint && (
        <p
          id={`${htmlFor}-description`}
          className="text-xs text-muted-foreground"
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
