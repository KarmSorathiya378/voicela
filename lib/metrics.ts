export const EVENTS = {
  PAGE_VIEW: "page_view",
  DEMO_START: "demo_start",
  DEMO_COMPLETE: "demo_complete",
  WAITLIST_SUBMIT: "waitlist_submit",
  PLATFORM_INTEREST: "platform_interest",
  page_view: "page_view",
  demo_start: "demo_start",
  demo_complete: "demo_complete",
  waitlist_submit: "waitlist_submit",
  platform_interest: "platform_interest",
} as const;
export const ANALYTICS_CONSENT_KEY = "voicela:analytics-consent";
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}
export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_KEY,
      granted ? "granted" : "denied",
    );
  } catch {
    /* Storage may be unavailable. Consent remains off. */
  }
}
/** No collection or queue before consent. Do not pass email, transcripts, or file contents. */
export function track(event: string, data?: object): void {
  if (!hasAnalyticsConsent()) return;
  try {
    console.debug("[Voicela analytics]", event, data ?? {});
  } catch {
    /* Analytics must never interrupt the product. */
  }
}
