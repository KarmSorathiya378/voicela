"use client";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-motion";

export interface SignalRibbonProps {
  /** 0..1 simulated microphone amplitude (mirrors AnimatedVoiceOrb activity). */
  activity?: number;
  /** 0..1 task progress; when >0 the ribbon simplifies into a progress line. */
  progress?: number;
  /** True while a task is executing (listening → acting → completing). */
  active?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Original "signal ribbon" identity (Design.md §3): one thin thread that reacts
 * to simulated microphone amplitude and, while a task executes, simplifies into
 * a clean progress line. Built from the same line/amplitude model as
 * AnimatedVoiceOrb — no audio capture, no gradients, no glow, and it stays
 * nearly invisible at rest.
 */
export function SignalRibbon({
  activity = 0,
  progress = 0,
  active = false,
  label = "Signal",
  className,
  style,
}: SignalRibbonProps) {
  const reduce = useReducedMotion();
  const level = Number.isFinite(activity)
    ? Math.min(1, Math.max(0, activity))
    : 0;
  const value = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  const executing = Boolean(active) || value > 0;

  return (
    <div
      className={cn(
        "v-signal",
        executing && "v-signal-active",
        className,
      )}
      role="img"
      aria-label={`${label}: ${
        executing
          ? `${Math.round(value * 100)}%`
          : `${Math.round(level * 100)}%`
      }`}
      style={style}
    >
      <svg className="v-signal-svg" viewBox="0 0 320 24" fill="none">
        {/* quiet baseline hairline */}
        <line
          x1="0"
          y1="12"
          x2="320"
          y2="12"
          stroke="currentColor"
          strokeOpacity="0.16"
        />
        {!reduce && (
          <g className="v-signal-ticks" aria-hidden="true">
            {Array.from({ length: 40 }, (_, i) => {
              const x = 6 + i * 7.8;
              const swell = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.72));
              const h = 2 + level * 12 * swell;
              return (
                <rect
                  key={i}
                  x={x - 1}
                  y={12 - h / 2}
                  width="2"
                  height={h}
                  rx="1"
                  fill="currentColor"
                  opacity={executing ? 0 : 0.05 + level * 0.55}
                />
              );
            })}
          </g>
        )}
      </svg>
      <div
        className="v-signal-progress"
        aria-hidden="true"
        style={{ width: `${value * 100}%`, opacity: executing ? 1 : 0 }}
      />
    </div>
  );
}
