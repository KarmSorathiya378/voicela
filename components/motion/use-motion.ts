"use client";
import { useSyncExternalStore } from "react";
const query = "(prefers-reduced-motion: reduce)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
/** Conservative on the server: never hide content or start motion before hydration. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}
export function useMotion() {
  return !useReducedMotion();
}
export const MOTION = {
  hover: 0.16,
  panel: 0.24,
  hero: 0.6,
  easeOut: [0.23, 1, 0.32, 1] as const,
};
