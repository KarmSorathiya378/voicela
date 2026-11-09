import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Features | Voicela",
  description:
    "Explore Voicela's plans for dictation, agents, context, automation and privacy. Windows alpha waitlist; other platforms planned.",
};

const features = [
  {
    slug: "dictation",
    title: "Dictation",
    headline: "Start with your own words.",
    description:
      "A planned way to turn speech into an editable draft, with a chance to check the words before using them.",
  },
  {
    slug: "agent",
    title: "Agent",
    headline: "See the plan before the action.",
    description:
      "Explore how a spoken request could become a reviewable plan across supported apps, with approval before consequential steps.",
  },
  {
    slug: "context",
    title: "Context",
    headline: "Give your request a reference.",
    description:
      "The goal: let you choose the text, document or screen information that helps explain what you mean.",
  },
  {
    slug: "automation",
    title: "Automation",
    headline: "Make room for repeat work.",
    description:
      "Planned reusable workflows would let you review a familiar sequence instead of rebuilding every step from scratch.",
  },
  {
    slug: "privacy",
    title: "Privacy",
    headline: "Know what you are sharing.",
    description:
      "Understand the browser demo's boundaries and the intended controls for permissions, processing and cloud opt-in.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Container>
          <section className="border-b border-border py-16 sm:py-24 lg:py-28" aria-labelledby="features-heading">
            <Reveal>
              <p className="mb-5 text-sm font-medium text-accent">The Voicela feature guide</p>
              <h1 id="features-heading" className="v-display max-w-4xl">From a thought.<br />To a clear next step.</h1>
              <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Speak, add context, review the plan. Explore five parts of a voice-first experience being built around your control.
                </p>
                <div className="space-y-3 lg:justify-self-end">
                  <Badge variant="accent" dot>Windows alpha waitlist</Badge>
                  <p className="text-sm text-muted-foreground">macOS, Linux, Android and iOS planned.</p>
                  <p className="max-w-sm text-sm text-muted-foreground">The browser demo uses sample data. Desktop capabilities described here are planned, not generally available.</p>
                </div>
              </div>
            </Reveal>
          </section>
        </Container>

        <Section title="Explore the features" subtitle="What each part is intended to do, and where it stands today.">
          <div className="grid gap-5 md:grid-cols-2">
            {features.map((feature) => (
              <Link key={feature.slug} href={`/features/${feature.slug}`} className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                <Card className="flex h-full flex-col transition-colors duration-150 group-hover:border-accent">
                  <CardHeader>
                    <div className="mb-6 flex items-center justify-between gap-4">
                      <Badge variant="outline">Feature guide</Badge>
                      <ArrowUpRight size={22} aria-hidden="true" className="text-accent" />
                    </div>
                    <CardTitle className="text-3xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <p className="mb-3 text-lg font-medium text-foreground">{feature.headline}</p>
                    <p className="max-w-prose leading-relaxed">{feature.description}</p>
                    <span className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-accent">Explore {feature.title.toLowerCase()}<ArrowRight size={16} aria-hidden="true" /></span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </Section>

        <Section className="border-t border-border bg-muted" title="See the idea in action" subtitle="Try a browser simulation with sample data. It does not record your microphone or access your real files, inbox or calendar.">
          <div className="flex flex-col items-start gap-3 sm:flex-row">
            <Button asChild><Link href="/demo">Try the interactive demo<ArrowUpRight size={16} aria-hidden="true" /></Link></Button>
            <Button asChild variant="outline"><a href="#footer-waitlist">View waitlist preview</a></Button>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
