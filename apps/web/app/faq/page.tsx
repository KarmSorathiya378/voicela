import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "FAQ — Voicela",
  description: "Answers about Voicela’s browser simulation, platform roadmap, proposed ₹1 pilot, waitlist and source availability.",
};

const items = [
  {
    question: "What is Voicela?",
    answer: "Voicela is a planned voice-first application layer for existing operating systems. The idea is to turn spoken intent into a plan and actions through supported apps and approved integrations. It is not a new operating system. This website demonstrates the idea with sample data.",
  },
  {
    question: "Can this site access my microphone or personal data?",
    answer: "No. The demo does not request microphone access, record audio, or connect to your real files, inbox or calendar. Its interactions use seeded sample data. Text you enter into preview forms stays in the browser; the current contact and waitlist forms do not send or store it on a server.",
  },
  {
    question: "Which desktop platforms are available?",
    answer: "There is no desktop download available here today. Windows is first on the roadmap, with an alpha waitlist planned. macOS is planned after Windows; Linux is in compatibility research. Android and iOS are future mobile plans. Features will depend on each platform’s permissions, and no release date is promised.",
  },
  {
    question: "What does the ₹1 pilot cover?",
    answer: "₹1 is a proposed PC introductory pilot price, not a live purchase offer. Its term and billing period are undecided, as are usage caps, taxes and renewal terms. No payment is collected and no subscription starts on this site. Final terms must be published before enrollment opens.",
  },
  {
    question: "How do I join the Windows alpha waitlist?",
    answer: <p>The <Link href="#footer-waitlist" className="text-accent underline underline-offset-4">waitlist form below</Link> previews the signup flow. It validates an email address locally but does not save a registration or send an email. Submitting it does not reserve an alpha place. A connected signup channel is still needed before real enrollment can begin.</p>,
  },
  {
    question: "Is Voicela open source?",
    answer: "Open-source status is not confirmed. This site does not publish a source repository or a software license, so it should not be treated as an open-source release. Any future source release and its license will need a separate announcement.",
  },
  {
    question: "Will the desktop app run entirely on my device?",
    answer: "Local processing is a preference, not a promise. What can run locally depends on hardware, models and the task. The desktop plan calls for informed opt-in for cloud processing; this website does not demonstrate a working local or cloud assistant.",
  },
  {
    question: "Can I explore the demo without speaking?",
    answer: <p>Yes. The <Link href="/demo" className="text-accent underline underline-offset-4">browser demo</Link> uses typed interactions and sample scenarios. No microphone is needed. Editable transcripts and keyboard controls are also part of the desktop plan.</p>,
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="main-content">
        <Section className="pb-10 sm:pb-14">
          <Reveal className="max-w-3xl">
            <h1 className="v-display">A few clear answers.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">What works today, what is planned, and what is still being decided.</p>
            <div className="mt-6"><Badge variant="outline">Browser simulation · desktop planned</Badge></div>
          </Reveal>
        </Section>
        <Container className="pb-16 sm:pb-24">
          <div className="max-w-3xl">
            <Accordion items={items} name="voicela-faq" />
            <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">Have a different question?</p>
              <Button asChild variant="outline"><Link href="/contact">Contact options</Link></Button>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
