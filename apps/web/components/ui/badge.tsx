import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "outline" | "success";
  dot?: boolean;
}
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "default", dot, className, children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium leading-5",
        {
          default: "bg-muted text-muted-foreground",
          accent: "bg-accent-soft text-accent",
          outline: "border border-border text-muted-foreground",
          success: "bg-muted text-success",
        }[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
});
export const Pill = Badge;
