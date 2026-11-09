import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted" | "outline";
}
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg p-6 sm:p-8",
        variant === "muted" ? "bg-muted" : "border border-border",
        variant === "default" && "bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
});
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function CardHeader({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn("mb-6 space-y-2", className)} {...props} />
  );
});
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...props }, ref) {
  return (
    <h3 ref={ref} className={cn("text-xl font-medium", className)} {...props} />
  );
});
export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function CardContent({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
