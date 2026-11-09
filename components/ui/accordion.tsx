import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
export interface AccordionItem {
  id?: string;
  question: ReactNode;
  answer: ReactNode;
}
export interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  items: readonly AccordionItem[];
  name?: string;
}
/** Native details keeps answers readable and keyboard-operable without JavaScript. */
export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  function Accordion({ items, className, name, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "divide-y divide-border border-y border-border",
          className,
        )}
        {...props}
      >
        {items.map((item, index) => (
          <details className="group" key={item.id ?? index} name={name}>
            <summary className="flex min-h-16 list-none items-center justify-between gap-6 py-5 text-base font-medium [&::-webkit-details-marker]:hidden">
              {item.question}
              <Plus
                aria-hidden="true"
                size={18}
                className="shrink-0 group-open:hidden"
              />
              <Minus
                aria-hidden="true"
                size={18}
                className="hidden shrink-0 group-open:block"
              />
            </summary>
            <div className="max-w-[70ch] pb-6 pr-8 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    );
  },
);
