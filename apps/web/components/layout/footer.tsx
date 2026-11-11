"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, AudioLines } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { submitWaitlist } from "@/lib/waitlist";
import { EVENTS, track } from "@/lib/metrics";

export { Footer };

export default function Footer() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setPending(true);
    setError("");
    setMessage("");
    try {
      await submitWaitlist(email);
      track(EVENTS.WAITLIST_SUBMIT, { source: "footer", simulated: true });
      setMessage(
        "Demo complete. Your email was validated; no signup has been saved yet.",
      );
      form.reset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <footer className="border-t border-border bg-background">
      <Container>
        <div
          id="footer-waitlist"
          className="grid gap-10 py-16 lg:grid-cols-2 lg:gap-20 lg:py-20"
        >
          <div>
            <p className="mb-4 text-sm text-accent">
              The next chapter is spoken.
            </p>
            <h2 className="max-w-lg text-4xl font-medium sm:text-5xl">
              Less between you
              <br />
              and your next idea.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Windows comes first. Explore the browser demo while the desktop
              experience takes shape.
            </p>
          </div>
          <form
            onSubmit={submit}
            className="self-center"
            aria-label="Waitlist preview"
          >
            <Field label="Your email" htmlFor="footer-email" error={error}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="footer-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                  aria-invalid={!!error}
                  aria-describedby={
                    error
                      ? "footer-email-error footer-waitlist-note"
                      : "footer-waitlist-note"
                  }
                />
                <Button type="submit" loading={pending}>
                  Join waitlist
                  <ArrowRight aria-hidden="true" size={16} />
                </Button>
              </div>
            </Field>
            <p
              id="footer-waitlist-note"
              className="mt-3 text-[0.8rem] leading-relaxed text-muted-foreground"
            >
              Waitlist preview only. Email is not stored or sent. Read our{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-2 hover:text-foreground"
              >
                privacy policy
              </Link>
              .
            </p>
            <p
              role="status"
              aria-live="polite"
              className="mt-3 text-sm text-accent"
            >
              {message}
            </p>
          </form>
        </div>
        <div className="flex flex-col justify-between gap-6 border-t border-border py-8 sm:flex-row sm:items-center">
          <Link
            href="/"
            aria-label="Voicela home"
            className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <AudioLines size={22} aria-hidden="true" />
            voicela.
          </Link>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground"
          >
            {[
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "/security", label: "Security" },
              { href: "/contact", label: "Contact" },
            ].map((link) => (
              <Link
                className="inline-flex min-h-11 items-center hover:text-foreground"
                key={link.href}
                href={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">© 2026 Voicela</p>
        </div>
      </Container>
    </footer>
  );
}
