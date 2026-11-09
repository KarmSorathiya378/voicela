import type { Metadata } from "next";
import Script from "next/script";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Reveal } from "@/components/motion/reveal";
import { track, EVENTS } from "@/lib/metrics";

export const metadata: Metadata = {
  title: "Account preview | Voicela",
  description: "Preview the Voicela sign-in screen. Accounts and account features are coming; this form does not authenticate or send credentials.",
  robots: { index: false, follow: true },
};

// A delegated listener also handles returning here through client navigation.
// method="dialog" prevents a native network submission before the script loads.
const previewScript = `
  document.addEventListener('submit', function (event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'account-preview') return;
    event.preventDefault();
    const status = form.querySelector('[role="status"]');
    if (status) status.textContent = 'Sign-in preview only — no account exists yet';
    form.reset();
  });
`;

export default function AccountPage() {
  // The shared helper is consent-gated; credentials never enter analytics.
  track(EVENTS.PAGE_VIEW, { page: "/account" });
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background text-foreground">
        <Section containerClassName="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <header className="max-w-xl">
              <h1 className="v-display">A place for your account.</h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Account features are coming. For now, take a look at the sign-in
                experience while we build what goes behind it.
              </p>
              <p className="mt-6 max-w-prose text-sm leading-relaxed text-muted-foreground">
                Profile settings, preferences, and account management are planned.
                There are no accounts to create or sign in to yet.
              </p>
            </header>
          </Reveal>
          <Card className="w-full max-w-lg lg:justify-self-end">
            <CardHeader>
              <Badge variant="outline" className="mb-3">Preview only</Badge>
              <CardTitle>Sign in</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Use sample details to try the form. Nothing is sent or saved.
              </p>
            </CardHeader>
            <CardContent>
              <form id="account-preview" method="dialog" className="space-y-5" aria-label="Sign-in preview" aria-describedby="account-preview-note">
                <Field label="Email" htmlFor="account-email" required hint="Try a sample address, such as you@example.com.">
                  <Input id="account-email" type="email" autoComplete="off" placeholder="you@example.com" required aria-describedby="account-email-description" />
                </Field>
                <Field label="Password" htmlFor="account-password" required hint="Use a made-up password for this preview.">
                  <Input id="account-password" type="password" autoComplete="off" required aria-describedby="account-password-description" />
                </Field>
                <Button type="submit" className="w-full">Preview sign-in</Button>
                <p role="status" aria-live="polite" aria-atomic="true" className="min-h-12 text-sm leading-relaxed text-foreground" />
                <p id="account-preview-note" className="text-xs leading-relaxed text-muted-foreground">
                  This form only displays a preview message. It does not check
                  credentials or create an account.
                </p>
                <noscript>
                  <p className="text-sm leading-relaxed">Sign-in preview only — no account exists yet. Enable JavaScript to try the preview interaction.</p>
                </noscript>
              </form>
            </CardContent>
          </Card>
        </Section>
        <Container className="pb-12">
          <p className="text-sm text-muted-foreground">Account features coming. No registration is available yet.</p>
        </Container>
      </main>
      <Footer />
      <Script id="voicela-account-preview" strategy="afterInteractive">{previewScript}</Script>
    </>
  );
}
