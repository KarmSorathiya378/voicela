"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitWaitlist, type Platform } from "@/lib/waitlist";
import { EVENTS, track } from "@/lib/metrics";

const platforms: { value: Platform; label: string }[] = [
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "linux", label: "Linux" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
];

export function WaitlistForm() {
  const submitting = useRef(false);
  const [platform, setPlatform] = useState<Platform>("windows");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    submitting.current = true;
    setPending(true);
    setError("");
    setSuccess(false);

    try {
      const result = await submitWaitlist(email, platform);
      if (result.ok) {
        track(EVENTS.WAITLIST_SUBMIT, { platform });
        setSuccess(true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not record your interest. Please try again.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Field
        htmlFor="waitlist-email"
        label="Email address"
        required
        hint="Your email will be sent to the waitlist API to record your interest."
        error={error}
      >
        <Input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={`waitlist-email-description${error ? " waitlist-email-error" : ""}`}
          onChange={() => {
            setError("");
            setSuccess(false);
          }}
          className="w-full"
        />
      </Field>
      <Field
        htmlFor="waitlist-platform"
        label="Preferred platform"
        required
        hint="Windows is the first priority. macOS, Linux, Android, and iOS remain pending on the roadmap."
      >
        <select
          id="waitlist-platform"
          name="platform"
          value={platform}
          required
          disabled={pending}
          aria-invalid={false}
          aria-describedby="waitlist-platform-description"
          onChange={(event) => {
            setPlatform(event.target.value as Platform);
            setError("");
            setSuccess(false);
          }}
          className="v-input w-full text-base"
        >
          {platforms.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Button
        type="submit"
        loading={pending}
        disabled={pending}
        className="w-full sm:w-auto"
      >
        Join the waitlist
      </Button>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-sm text-muted-foreground"
      >
        {success
          ? "Your interest is recorded. No payment was requested or taken. Specific platforms and launch dates are still pending; joining does not guarantee access."
          : pending
            ? "Recording your interest…"
            : "Choose your preferred platform to record your interest."}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Interest is recorded via the waitlist API. No payment is requested.
        Specific platforms and dates are still pending.
      </p>
    </form>
  );
}
