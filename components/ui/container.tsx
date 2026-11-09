import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "default" | "wide" | "narrow";
}
export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  function Container({ className, size = "default", ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "mx-auto w-full px-5 sm:px-8 lg:px-12",
          { default: "max-w-7xl", wide: "max-w-[1440px]", narrow: "max-w-3xl" }[
            size
          ],
          className,
        )}
        {...props}
      />
    );
  },
);
