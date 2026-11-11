"use client";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  asChild?: boolean;
  loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      asChild,
      loading,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    const classes = cn(
      "v-button",
      `v-button-${variant}`,
      {
        sm: "px-3 py-2",
        md: "px-5 py-3",
        lg: "min-h-13 px-6 py-3.5 text-base",
        icon: "size-11 p-0",
      }[size],
      className,
    );
    if (asChild) {
      // React 19 RSC can deliver children as a lazy node. toArray resolves it
      // before enforcing the single-element slot contract.
      const slots = Children.toArray(children);
      if (slots.length !== 1)
        throw new Error("Button asChild requires one element.");
      const child = slots[0];
      if (
        !isValidElement<
          HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }
        >(child)
      )
        throw new Error("Button asChild requires one element.");
      return cloneElement(
        child as ReactElement<
          HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }
        >,
        {
          ...props,
          ...child.props,
          ref: ref as Ref<HTMLElement>,
          className: cn(classes, child.props.className),
          "aria-disabled": disabled || loading || undefined,
          "aria-busy": loading || undefined,
          tabIndex: disabled || loading ? -1 : child.props.tabIndex,
          onClick: (event) => {
            if (disabled || loading) {
              event.preventDefault();
              return;
            }
            child.props.onClick?.(event);
            if (!event.defaultPrevented)
              props.onClick?.(
                event as unknown as React.MouseEvent<HTMLButtonElement>,
              );
          },
        },
      );
    }
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={classes}
      >
        {loading ? <span role="status">Working…</span> : children}
      </button>
    );
  },
);
