"use client";
import { useId, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-motion";
export interface AnimatedVoiceOrbProps extends HTMLAttributes<HTMLDivElement> {
  activity?: number;
  size?: number | string;
  label?: string;
}
/** A line-built acoustic field. No audio capture, timers, raster assets, or gradients. */
export function AnimatedVoiceOrb({
  activity = 0,
  size = 280,
  label = "Voice activity",
  className,
  style,
  ...props
}: AnimatedVoiceOrbProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const level = Number.isFinite(activity)
    ? Math.min(1, Math.max(0, activity))
    : 0;
  return (
    <div
      {...props}
      className={cn(
        "relative inline-flex max-w-full items-center justify-center text-accent",
        !reduce && level < 0.01 && "v-orb-idle",
        className,
      )}
      style={{ width: size, aspectRatio: "1", ...style }}
    >
      <svg
        viewBox="0 0 240 240"
        fill="none"
        role="img"
        aria-labelledby={id}
        className="h-full w-full overflow-visible"
      >
        <title id={id}>{`${label}: ${Math.round(level * 100)}%`}</title>
        <circle
          cx="120"
          cy="120"
          r="106"
          stroke="currentColor"
          strokeOpacity=".12"
          strokeDasharray="1 7"
        />
        {Array.from({ length: 13 }, (_, i) => {
          const tilt = -58 + i * 9.6;
          return (
            <ellipse
              key={i}
              cx="120"
              cy="120"
              rx={24 + i * 4.7}
              ry="78"
              stroke="currentColor"
              strokeWidth={i === 6 ? 1.2 : 0.65}
              opacity={0.17 + (i === 6 ? 0.5 : level * 0.25)}
              className="v-orb-ring"
              style={{
                transform: `rotate(${tilt}deg) scale(${reduce ? 1 : 1 + level * 0.12 * Math.sin(i + 1)})`,
              }}
            />
          );
        })}
        <circle
          cx="120"
          cy="120"
          r="36"
          fill="var(--background)"
          fillOpacity=".85"
        />
        <g
          className="v-orb-core"
          style={{ transform: `scale(${reduce ? 1 : 1 + level * 0.16})` }}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const height =
              10 + (2 - Math.abs(2 - i)) * 8 + level * (12 + i * 2);
            return (
              <rect
                key={i}
                x={102 + i * 8}
                y={120 - height / 2}
                width="4"
                height={height}
                rx="2"
                fill="currentColor"
              />
            );
          })}
        </g>
        <path
          d="M120 9v8m0 206v8M9 120h8m206 0h8"
          stroke="currentColor"
          strokeOpacity=".4"
        />
      </svg>
    </div>
  );
}
