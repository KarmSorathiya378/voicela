import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Updates — Voicela",
  description:
    "Shipped updates to Voicela's public site, design system, original artwork, browser demo lab and live waitlist backend.",
};

const milestones = [
  {
    date: "2026-11-04",
    label: "4 November 2026",
    tag: "Launch",
    status: "Live",
    heading: "Site launch",
    body: "The public site shipped with a landing page, product overview, FAQ, security information, terms and privacy pages, and contact page.",
    href: null,
  },
  {
    date: "2026-11-05",
    label: "5 November 2026",
    tag: "Foundation",
    status: "Shipped",
    heading: "Design system",
    body: "A reusable, accessible set of UI primitives keeps pages consistent: Button, Card, Field, Input, Section, Container, Navbar and Footer.",
    href: null,
  },
  {
    date: "2026-11-06",
    label: "6 November 2026",
    tag: "Art",
    status: "Shipped",
    heading: "Original artwork set",
    body: "Custom illustrations and icons replaced placeholder assets across the site.",
    href: null,
  },
  {
    date: "2026-11-07",
    label: "7 November 2026",
    tag: "Product",
    status: "Live",
    heading: "Interactive demo lab",
    body: "A browser-only simulation lets visitors explore file, email, calendar and chart workflows using sample data. It requests no microphone access, connects no personal accounts and executes no workflow actions on the visitor's machine.",
    href: "/demo",
  },
  {
    date: "2026-11-08",
    label: "8 November 2026",
    tag: "Infrastructure",
    status: "Live",
    heading: "Waitlist backend",
    body: "POST /api/waitlist validates emails, rate-limits requests and persists signups, recording interest in the planned Windows alpha.",
    href: null,
  },
] as const;

export default function UpdatesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="main-content">
        <Section className="pb-10 sm:pb-14" aria-labelledby="updates-heading">
          <Reveal className="max-w-3xl">
            <h1 id="updates-heading" className="v-display">Updates</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              A record of what has shipped, from the public site to the tools behind it.
            </p>
          </Reveal>
        </Section>
        <Container className="pb-16 sm:pb-24">
          <div className="max-w-4xl divide-y divide-border border-y border-border">
            {milestones.map((milestone) => (
              <article
                key={milestone.date}
                aria-labelledby={`update-${milestone.date}`}
                className="grid gap-5 py-10 sm:grid-cols-[10rem_1fr] sm:gap-10"
              >
                <div className="space-y-3">
                  <time dateTime={milestone.date} className="block text-sm tabular-nums text-muted-foreground">
                    {milestone.label}
                  </time>
                  <Badge variant="outline">{milestone.status}</Badge>
                </div>
                <div className="min-w-0">
                  <h2 id={`update-${milestone.date}`} className="text-2xl font-medium sm:text-3xl">
                    {milestone.heading}
                  </h2>
                  <p className="mt-3 text-sm text-accent">{milestone.tag}</p>
                  <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-muted-foreground">
                    {milestone.body}
                  </p>
                  {milestone.href && (
                    <Link
                      href={milestone.href}
                      className="mt-5 inline-flex rounded-sm text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                    >
                      Explore the demo lab
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-10 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            These entries describe what ships today. Platform and timeline plans are separate and undated.
          </p>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
