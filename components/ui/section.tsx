import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Container } from "./container";
import { cn } from "@/lib/utils";
export interface SectionProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "title"
> {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  containerClassName?: string;
}
export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  {
    eyebrow,
    title,
    subtitle,
    align = "left",
    children,
    className,
    containerClassName,
    ...props
  },
  ref,
) {
  return (
    <section
      ref={ref}
      className={cn("py-[var(--space-section)]", className)}
      {...props}
    >
      <Container className={containerClassName}>
        {(eyebrow || title || subtitle) && (
          <header
            className={cn(
              "mb-12 max-w-3xl",
              align === "center" && "mx-auto text-center",
            )}
          >
            {eyebrow && (
              <p className="mb-4 text-sm font-medium text-accent">{eyebrow}</p>
            )}
            {title && (
              <h2 className="text-4xl font-medium sm:text-5xl lg:text-6xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-6 max-w-[65ch] text-lg leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
          </header>
        )}
        {children}
      </Container>
    </section>
  );
});
