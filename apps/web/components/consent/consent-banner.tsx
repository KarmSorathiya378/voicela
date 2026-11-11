"use client";

import { useEffect, useRef, useState } from "react";
import {
  ANALYTICS_CONSENT_KEY,
  setAnalyticsConsent,
} from "@/lib/metrics";

type ConsentState = "undecided" | "granted" | "denied";

function readStoredConsent(): ConsentState {
  if (typeof window === "undefined") return "undecided";
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (value === "granted") return "granted";
    if (value === "denied") return "denied";
    return "undecided";
  } catch {
    return "undecided";
  }
}

/**
 * Lightweight, accessible analytics-consent banner.
 *
 * Privacy-first: nothing is recorded until the visitor explicitly accepts.
 * The decision is persisted via setAnalyticsConsent (localStorage), and the
 * shared track() helper (lib/metrics.ts) stays gated on that consent.
 *
 * Accessibility: rendered as a non-modal dialog (`aria-modal=false`), fully
 * keyboard operable (buttons + Escape to decline), labelled, and announced
 * politely. `prefers-reduced-motion` disables the entrance animation.
 */
export default function ConsentBanner() {
  const [state, setState] = useState<ConsentState>("undecided");
  const [ready, setReady] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const acceptRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq?.addEventListener("change", onChange);

    // Read the stored decision after mount (asynchronously) so returning
    // visitors don't see the banner again if they've already consented.
    const frame = requestAnimationFrame(() => {
      setState(readStoredConsent());
      setReady(true);
      setReducedMotion(mq?.matches ?? false);
    });

    return () => {
      cancelAnimationFrame(frame);
      mq?.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (ready && state === "undecided") {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      const frame = requestAnimationFrame(() => setAnimateIn(true));
      acceptRef.current?.focus();
      return () => cancelAnimationFrame(frame);
    }
  }, [ready, state]);

  const decide = (granted: boolean) => {
    setAnalyticsConsent(granted);
    setState(granted ? "granted" : "denied");
    returnFocusRef.current?.focus?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      decide(false);
    }
  };

  const show = ready && state === "undecided";

  if (!show) return null;

  return (
    <div aria-live="polite">
      <aside
        role="dialog"
        aria-modal="false"
        aria-labelledby="consent-title"
        onKeyDown={handleKeyDown}
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
      >
        <div
          className={`w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur transition-all duration-500 ${
            reducedMotion || animateIn
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="pr-2">
              <h2
                id="consent-title"
                className="text-sm font-semibold text-white"
              >
                We care about your privacy
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">
                We use anonymized analytics to understand how Voicela is used
                and improve it. No personal data, documents, or recordings are
                ever collected. You&apos;re in control — you can change your
                choice anytime.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                ref={acceptRef}
                onClick={() => decide(true)}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => decide(false)}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => decide(false)}
                aria-label="Dismiss and decline"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="M6 6l8 8M14 6l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
