import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn("v-input resize-y text-base", className)}
      {...props}
    />
  );
});
