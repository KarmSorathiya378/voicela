export type Platform = "windows" | "macos" | "linux" | "android" | "ios";
export interface WaitlistResult {
  ok: true;
  email: string;
}

interface ErrorBody {
  ok: false;
  error: string;
}

const SUPPORTED_PLATFORMS: readonly string[] = [
  "windows",
  "macos",
  "linux",
  "android",
  "ios",
];

/**
 * Records a waitlist signup against the real backend API.
 * Keeps the historical client-side guards for instant feedback, then calls
 * POST /api/waitlist. Returns `{ ok: true, email }` on success and throws an
 * Error with a human-friendly message on any failure, so existing callers'
 * try/catch handling keeps working.
 */
export async function submitWaitlist(
  email: string,
  platform?: Platform,
): Promise<WaitlistResult> {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new Error("Enter a valid email address.");
  if (platform && !SUPPORTED_PLATFORMS.includes(platform))
    throw new Error("Choose a supported platform.");

  // Simulate a short latency before hitting the network, as before.
  await new Promise<void>((resolve) => setTimeout(resolve, 300));

  let response: Response;
  try {
    response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalized,
        ...(platform ? { platform } : {}),
      }),
    });
  } catch {
    throw new Error(
      "Could not reach the server. Please check your connection and try again.",
    );
  }

  if (response.ok) {
    const data = (await response.json()) as Partial<WaitlistResult>;
    return { ok: true, email: data.email ?? normalized };
  }

  let message = "Something went wrong. Please try again.";
  try {
    const data = (await response.json()) as ErrorBody;
    if (data && typeof data.error === "string" && data.error) message = data.error;
  } catch {
    // Ignore malformed error bodies; fall back to the generic message.
  }

  if (response.status === 429) {
    message = "Too many requests. Please try again a little later.";
  } else if (response.status === 409) {
    message = "This email is already on the waitlist.";
  } else if (response.status === 500) {
    message = "Something went wrong on our end. Please try again.";
  }

  throw new Error(message);
}
