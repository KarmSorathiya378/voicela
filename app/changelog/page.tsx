import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Changelog — Voicela",
  description: "Draft development notes for Voicela: the browser simulation, planned Windows alpha waitlist and future platform roadmap.",
};

const posts = [
  {
    date: "2026-11-09",
    label: "9 November 2026",
    tag: "Windows alpha · planned",
    heading: "Windows comes first.",
    body: "The first planned desktop release is a Windows alpha. The next enrollment step is a connected waitlist; the current website form only validates an email locally and does not save a place. There is no alpha download or confirmed release date yet.",
  },
  {
    date: "2026-11-08",
    label: "8 November 2026",
    tag: "Browser preview",
    heading: "Try the idea with sample data.",
    body: "The browser simulation illustrates file, email, calendar and chart workflows with seeded examples and typed input. It does not record a microphone, access personal accounts or perform actions on your computer. These notes describe a preview, not a desktop release.",
  },
  {
    date: "2026-11-07",
    label: "7 November 2026",
    tag: "Roadmap",
    heading: "Other platforms have their own path.",
    body: "macOS is planned after Windows, while Linux remains in compatibility research. Android and iOS are future mobile plans. Each platform needs its own permissions and capability checks; feature parity and delivery dates are not promised. The proposed ₹1 PC pilot also has no decided term or billing period.",
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="main-content">
        <Section className="pb-10 sm:pb-14">
          <Reveal className="max-w-3xl">
            <h1 className="v-display">Notes as we build.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">A working record of the direction ahead. Every entry below is an editorial draft, not a shipped release announcement.</p>
          </Reveal>
        </Section>
        <Container className="pb-16 sm:pb-24">
          <div className="max-w-4xl divide-y divide-border border-y border-border">
            {posts.map((post) => (
              <article key={post.date} className="grid gap-5 py-10 sm:grid-cols-[10rem_1fr] sm:gap-10" aria-labelledby={`post-${post.date}`}>
                <div className="space-y-3">
                  <time dateTime={post.date} className="block text-sm tabular-nums text-muted-foreground">{post.label}</time>
                  <Badge variant="outline">Draft</Badge>
                </div>
                <div>
                  <p className="mb-3 text-sm text-accent">{post.tag}</p>
                  <h2 id={`post-${post.date}`} className="text-2xl font-medium sm:text-3xl">{post.heading}</h2>
                  <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-muted-foreground">{post.body}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-10"><Button asChild variant="outline"><Link href="/faq">Read the FAQ</Link></Button></div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
