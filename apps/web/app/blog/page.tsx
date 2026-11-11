import type { Metadata } from "next";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";
import { track, EVENTS } from "@/lib/metrics";

export const metadata: Metadata = {
  title: "Blog | Voicela",
  description: "Draft notes on voice, thoughtful software, and building Voicela. No articles are published yet.",
};

const posts = [
  {
    slug: "start-with-intent",
    date: "2026-11-09",
    category: "Design",
    title: "Start with intent, then find the words",
    excerpt: "A draft exploration of how voice interfaces could help turn a half-formed thought into a clear next step, without taking the decision away from you.",
  },
  {
    slug: "preview-before-action",
    date: "2026-11-08",
    category: "Product notes",
    title: "A preview before an action",
    excerpt: "Notes on making proposed changes easy to inspect. What should an assistant show before a file moves, a message leaves, or a meeting changes?",
  },
  {
    slug: "space-to-correct",
    date: "2026-11-07",
    category: "Voice & interaction",
    title: "Leave room for a second thought",
    excerpt: "An early look at corrections, pauses, and the everyday ways people change their minds while speaking. An interface should leave space for all three.",
  },
  {
    slug: "honest-demo",
    date: "2026-11-06",
    category: "Building Voicela",
    title: "What a demo should tell you",
    excerpt: "A working outline on distinguishing a simulated workflow from a connected product, and why those boundaries belong in the interface itself.",
  },
];

export default function BlogPage() {
  // The shared helper is consent-gated and safely no-ops during server rendering.
  track(EVENTS.PAGE_VIEW, { page: "/blog" });
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background text-foreground">
        <Container className="pt-16 sm:pt-24">
          <Reveal>
            <header className="max-w-3xl">
              <h1 className="v-display">Notes on building Voicela.</h1>
              <p className="mt-6 max-w-prose text-lg leading-relaxed text-muted-foreground">
                Ideas about voice, useful software, and keeping people in control.
                A notebook for work still taking shape.
              </p>
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                All entries below are drafts. Dates are draft dates; no articles
                are published or available to open yet.
              </p>
            </header>
          </Reveal>
        </Container>
        <Section aria-labelledby="drafts-heading">
          <h2 id="drafts-heading" className="mb-8 text-2xl font-medium">From the notebook</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {posts.map((post) => (
              <article key={post.slug} aria-labelledby={post.slug}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="mb-5 flex flex-wrap items-center gap-3">
                      <Badge variant="accent">{post.category}</Badge>
                      <Badge variant="outline">Draft</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <time dateTime={post.date}>
                        {new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${post.date}T00:00:00Z`))}
                      </time>
                    </p>
                    <CardTitle id={post.slug} className="text-2xl leading-snug">{post.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-base leading-relaxed">{post.excerpt}</CardContent>
                </Card>
              </article>
            ))}
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
