"use client";
import { useState, type CSSProperties, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export interface MarqueeProps extends HTMLAttributes<HTMLDivElement> {
  duration?: number;
  reverse?: boolean;
}
export function Marquee({
  children,
  duration = 30,
  reverse,
  className,
  style,
  ...props
}: MarqueeProps) {
  const [paused, setPaused] = useState(false);
  return (
    <div
      {...props}
      className={cn("v-marquee relative overflow-hidden", className)}
      data-paused={paused}
      style={
        {
          ...style,
          "--marquee-duration": `${Math.max(1, duration)}s`,
        } as CSSProperties
      }
    >
      <div
        className="v-marquee-track"
        style={{ animationDirection: reverse ? "reverse" : "normal" }}
      >
        <div className="flex shrink-0 items-center gap-10 pr-10">
          {children}
        </div>
        <div
          aria-hidden="true"
          inert
          className="v-marquee-copy flex shrink-0 items-center gap-10 pr-10"
        >
          {children}
        </div>
      </div>
      <button
        type="button"
        className="mt-4 min-h-11 px-2 text-xs text-muted-foreground motion-reduce:hidden"
        onClick={() => setPaused(!paused)}
        aria-pressed={paused}
      >
        {paused ? "Resume motion" : "Pause motion"}
      </button>
    </div>
  );
}
