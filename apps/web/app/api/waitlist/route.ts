import { promises as fs } from "fs";
import path from "path";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PLATFORMS = ["windows", "macos", "linux", "android", "ios"] as const;
type Platform = (typeof ALLOWED_PLATFORMS)[number];

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "waitlist.json");

/**
 * In-memory per-IP rate limiting (timestamp-window / leaky bucket style).
 * This is intentionally ephemeral: it resets on server restart and does not
 * persist any IP addresses to disk. Not suitable for multi-instance scale,
 * but correct for a single Node process.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const recentRequests = new Map<string, number[]>();

interface WaitlistEntry {
  email: string;
  platform?: Platform;
  createdAt: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowed = (recentRequests.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (windowed.length >= RATE_MAX) {
    recentRequests.set(ip, windowed);
    return true;
  }
  windowed.push(now);
  recentRequests.set(ip, windowed);
  return false;
}

async function readEntries(): Promise<WaitlistEntry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WaitlistEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeEntries(entries: WaitlistEntry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
}

function readBodyValue(
  body: unknown,
  key: string,
): unknown {
  if (typeof body === "object" && body !== null && key in body) {
    return (body as Record<string, unknown>)[key];
  }
  return undefined;
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json(
      { ok: false, error: "Too many requests. Please try again a little later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const rawEmail = readBodyValue(body, "email");
  const rawPlatform = readBodyValue(body, "platform");

  const email = normalizeEmail(typeof rawEmail === "string" ? rawEmail : "");
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return Response.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  let platform: Platform | undefined;
  if (rawPlatform !== undefined) {
    if (
      typeof rawPlatform !== "string" ||
      !(ALLOWED_PLATFORMS as readonly string[]).includes(rawPlatform)
    ) {
      return Response.json(
        { ok: false, error: "Choose a supported platform." },
        { status: 400 },
      );
    }
    platform = rawPlatform as Platform;
  }

  const entries = await readEntries();
  if (entries.some((entry) => entry.email === email)) {
    return Response.json(
      { ok: false, error: "This email is already on the waitlist." },
      { status: 409 },
    );
  }

  const entry: WaitlistEntry = {
    email,
    ...(platform ? { platform } : {}),
    createdAt: new Date().toISOString(),
  };

  try {
    entries.push(entry);
    await writeEntries(entries);
  } catch {
    return Response.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, email }, { status: 200 });
}
