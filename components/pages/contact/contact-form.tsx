"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { track, EVENTS } from "@/lib/metrics";

type Message = { name: string; email: string; message: string };
type Errors = Partial<Record<keyof Message, string>>;

export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [preview, setPreview] = useState<Message | null>(null);
  const [ready, setReady] = useState(false);
  const status = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track(EVENTS.PAGE_VIEW, { page: "contact" });
    queueMicrotask(() => setReady(true));
  }, []);

  useEffect(() => {
    if (preview) status.current?.focus();
  }, [preview]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values: Message = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      message: String(data.get("message") ?? "").trim(),
    };
    const next: Errors = {};
    if (!values.name) next.name = "Enter your name.";
    if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      next.email = "Enter a valid email address, such as you@example.com.";
    if (!values.message) next.message = "Write a message to preview.";
    setErrors(next);
    setPreview(null);
    const first = (["name", "email", "message"] as const).find((key) => next[key]);
    if (first) {
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setPreview(values);
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Contact message preview" className="space-y-6" onInput={() => setPreview(null)}>
      <fieldset disabled={!ready} className="min-w-0 space-y-6">
      <legend className="sr-only">Your message</legend>
      <Field label="Name" htmlFor="contact-name" required error={errors.name}>
        <Input id="contact-name" name="name" autoComplete="name" required maxLength={100} aria-invalid={!!errors.name} aria-describedby={errors.name ? "contact-name-error" : undefined} />
      </Field>
      <Field label="Email" htmlFor="contact-email" required error={errors.email}>
        <Input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={!!errors.email} aria-describedby={errors.email ? "contact-email-error" : undefined} />
      </Field>
      <Field label="Message" htmlFor="contact-message" required error={errors.message} hint="Up to 5,000 characters. Your message stays in this browser tab.">
        <Textarea id="contact-message" name="message" rows={6} required maxLength={5000} aria-invalid={!!errors.message} aria-describedby={`contact-message-description${errors.message ? " contact-message-error" : ""}`} />
      </Field>
      <Button type="submit" className="w-full sm:w-auto">Preview message</Button>
      </fieldset>
      <noscript><p className="text-sm text-muted-foreground">Enable JavaScript to preview a message. This form has no email delivery service.</p></noscript>
      <div role="status" aria-live="polite" aria-atomic="true">
        {preview && (
          <div ref={status} tabIndex={-1} className="space-y-4 rounded-lg border border-border p-5 focus-visible:outline-2 focus-visible:outline-ring">
            <Badge variant="success">Preview ready</Badge>
            <p className="font-medium">Message preview only — no email is sent</p>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-muted-foreground">Name</dt><dd className="mt-1 break-words">{preview.name}</dd></div>
              <div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-all">{preview.email}</dd></div>
              <div><dt className="text-muted-foreground">Message</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{preview.message}</dd></div>
            </dl>
            <p className="text-sm text-muted-foreground">Nothing was sent or saved on a server. Edit a field to prepare another preview.</p>
          </div>
        )}
      </div>
    </form>
  );
}
