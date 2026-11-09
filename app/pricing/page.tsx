import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Pricing — Voicela",
  description:
    "Explore Voicela’s proposed ₹1 PC introductory plan. Billing terms are undecided, and no payment is collected today.",
};

const terms = [
  ["Billing period", "Undecided; a one-time purchase is not confirmed."],
  ["Offer duration", "Still being validated."],
  ["Usage caps", "Still being validated; unlimited usage is not promised."],
  ["Taxes", "Treatment and any applicable taxes are still being validated."],
  ["Renewal terms", "Still being validated; no subscription starts today."],
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Container className="pt-16 sm:pt-24">
          <Reveal>
            <h1 className="v-display max-w-4xl text-balance">
              A small start.<br />A considered price.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              A proposed introductory plan for PC. We’re working through the
              details before asking you to pay.
            </p>
          </Reveal>
        </Container>

        <Section aria-label="Proposed plan and billing details">
          <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <Card className="bg-card">
              <CardHeader>
                <Badge variant="accent">Proposed introductory plan</Badge>
                <CardTitle className="pt-4 text-2xl">Voicela for PC</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-7xl font-medium tracking-tight text-foreground sm:text-8xl">₹1</p>
                  <p className="mt-3">Billing period undecided</p>
                </div>
                <p className="leading-relaxed">
                  An introductory price under consideration, not an offer you can
                  purchase yet. Plan features and availability will be confirmed
                  before launch.
                </p>
                <p className="font-medium text-foreground">No payment today. No checkout. No subscription started.</p>
                <Button asChild className="w-full">
                  <Link href="/demo">Try the browser demo <ArrowUpRight size={17} aria-hidden="true" /></Link>
                </Button>
                <p className="text-xs leading-relaxed">The demo is free and uses sample data. It does not control your device.</p>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-3xl font-medium sm:text-4xl">The terms come first.</h2>
              <p className="mt-5 max-w-prose leading-relaxed text-muted-foreground">
                The billing period, duration, usage caps, taxes and renewal terms
                are still being validated. ₹1 does not yet define how long access
                lasts or what usage is included.
              </p>
              <dl className="mt-8 divide-y divide-border border-y border-border">
                {terms.map(([term, detail]) => (
                  <div key={term} className="grid gap-2 py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
                    <dt className="font-medium">{term}</dt>
                    <dd className="text-sm leading-relaxed text-muted-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Section>

        <Section className="border-t border-border" title="Try the idea. Follow the rollout.">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-lg text-muted-foreground">
              Windows is the first planned desktop release. Check platform
              availability and preview the alpha waitlist.
            </p>
            <Button asChild variant="outline">
              <Link href="/download">Explore platforms <ArrowUpRight size={17} aria-hidden="true" /></Link>
            </Button>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
