"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { submitWaitlist } from "@/lib/waitlist";
import { EVENTS, track } from "@/lib/metrics";

export function WindowsWaitlist() {
  const submitting = useRef(false);
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
      const result = await submitWaitlist(email, "windows");
      if (result.ok) {
        track(EVENTS.WAITLIST_SUBMIT, { platform: "windows", simulated: true });
        setSuccess(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not validate your email. Please try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Field
        htmlFor="windows-email"
        label="Email address"
        required
        hint="Waitlist preview only — email validated, not stored."
        error={error}
      >
        <Input
          id="windows-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={`windows-email-description${error ? " windows-email-error" : ""}`}
          onChange={() => {
            setError("");
            setSuccess(false);
          }}
          className="w-full"
        />
      </Field>
      <Button type="submit" loading={pending} className="w-full sm:w-auto">
        Try waitlist preview
      </Button>
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
        {success ? "Email validated. This was a preview: your email was not stored and you have not joined a waitlist." : pending ? "Validating your email…" : "No registration or email updates are created by this preview."}
      </p>
    </form>
  );
}
