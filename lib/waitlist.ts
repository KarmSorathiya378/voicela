export type Platform = "windows" | "macos" | "linux" | "android" | "ios";
export interface WaitlistResult {
  ok: true;
  email: string;
}
/** Local simulation only: no signup is persisted until a backend is connected. */
export async function submitWaitlist(
  email: string,
  platform?: Platform,
): Promise<WaitlistResult> {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new Error("Enter a valid email address.");
  if (
    platform &&
    !["windows", "macos", "linux", "android", "ios"].includes(platform)
  )
    throw new Error("Choose a supported platform.");
  await new Promise<void>((resolve) => setTimeout(resolve, 650));
  return { ok: true, email: normalized };
}
