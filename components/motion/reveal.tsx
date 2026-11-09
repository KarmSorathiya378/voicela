"use client";
import { useEffect, useRef, type HTMLAttributes } from "react";
import { useReducedMotion } from "./use-motion";
export interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  delay?: number;
  duration?: number;
  once?: boolean;
}
/** Progressive enhancement: content is visible before JS and for reduced-motion users. */
export function Reveal({
  children,
  delay = 0,
  duration = 0.6,
  once = true,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (reduce || !node || !("IntersectionObserver" in window)) return;
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animation?.cancel();
          animation = node.animate(
            [
              { opacity: 0.65, transform: "translateY(12px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: Math.min(duration, 0.6) * 1000,
              delay: Math.min(Math.max(delay, 0), 0.3) * 1000,
              easing: "cubic-bezier(.23, 1, .32, 1)",
            },
          );
          if (once) observer.unobserve(node);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  }, [reduce, delay, duration, once]);
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
