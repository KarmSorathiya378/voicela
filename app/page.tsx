import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Monitor, Smartphone } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Accordion } from "@/components/ui/accordion";
import {
  HeroActions,
  HeroInstrument,
  VoiceActivation,
  Workflow,
  DesktopPreview,
  ContextPreview,
  PrivacyLab,
  WaitlistForm,
} from "@/components/home/interactions";
import "@/components/home/home.css";
import { homeClasses as s } from "@/components/home/classes";
const description =
  "Turn spoken intent into clear, controlled actions. Explore Voicela’s browser demo, privacy controls and desktop roadmap.";
export const metadata: Metadata = {
  title: "Voicela — Less clicking. More doing.",
  description,
  openGraph: {
    title: "Voicela — Less clicking. More doing.",
    description,
    type: "website",
  },
};
const platforms = [
  ["Windows", "windows", "First desktop release · planned"],
  ["macOS", "macos", "After Windows · planned"],
  ["Linux", "linux", "Compatibility research"],
  ["Android", "android", "Future mobile release"],
  ["iOS", "ios", "Future mobile release"],
];
const questions = [
  {
    question: "Is Voicela a new operating system?",
    answer:
      "No. It is a planned voice-first application layer for existing operating systems. It translates intent into actions through supported apps and approved integrations.",
  },
  {
    question: "Does this website control my computer?",
    answer:
      "No. Every interaction here is a browser simulation using sample data. It cannot access your real inbox, calendar or files, and it does not record your microphone.",
  },
  {
    question: "Can I use it without speaking?",
    answer:
      "Yes. The website has a typed alternative to every voice interaction. The desktop plan also includes editable transcripts and keyboard controls.",
  },
  {
    question: "Will everything run locally?",
    answer:
      "Local processing is a preference, not a guarantee. Hardware, supported models and the task determine what can run locally. Cloud processing will require informed opt-in.",
  },
  {
    question: "What does the ₹1 offer include?",
    answer:
      "₹1 is a proposed PC introductory price. The billing period, duration, usage caps, taxes and renewal terms are still being validated. There is no payment or subscription to start today.",
  },
  {
    question: "When can I download it?",
    answer:
      "The web simulation is available now. Windows is the first planned desktop release; macOS, Linux and mobile follow separate readiness gates. Join the waitlist for updates. No release date is promised.",
  },
];
export default function Home() {
  return (
    <div className={s.home}>
      <Navbar />
      <main id="main-content">
        <Container>
          <section className={s.hero} aria-labelledby="hero-heading">
            <h1 id="hero-heading">
              Less clicking.
              <br />
              More doing.
            </h1>
            <div className={s.heroBottom}>
              <p>
                A voice-first layer for your computer. Say what you need. See
                the plan. Stay in control.
              </p>
              <HeroActions />
            </div>
            <HeroInstrument />
            <div className={s.heroCaption}>
              <span>Your intent. A clear path forward.</span>
              <span>Browser simulation · no device access</span>
            </div>
          </section>
        </Container>
        <Section
          id="voice"
          title="Start with a sentence."
          subtitle="No command language to learn. Try a sample voice interaction, or type it your way."
        >
          <VoiceActivation />
        </Section>
        <Section
          id="workflow"
          title="An open book of actions."
          subtitle="Follow the reasoning from request to review. Move forward, go back, or stop before anything is sent."
        >
          <Workflow />
        </Section>
        <Section
          id="desktop"
          title="One thought. Across apps."
          subtitle="A sample workspace, brought together by intent. Pick an app to explore what an approved workflow could look like."
        >
          <DesktopPreview />
        </Section>
        <Section
          id="context"
          title="Context, with boundaries."
          subtitle="Choose the text that matters. See exactly what the assistant is allowed to read."
        >
          <ContextPreview />
        </Section>
        <Section
          id="dictation"
          title="Words. Or a way forward."
          subtitle="Sometimes you need better text. Sometimes you need the next task taken care of."
        >
          <div className={s.comparison}>
            <article className={s.dictation} data-ui>
              <span>Dictation</span>
              <h3>Say it. Shape it.</h3>
              <p className={s.quote}>
                “Um, tell Maya I can do Thursday, actually Friday afternoon.”
              </p>
              <div className={s.paper}>
                Hi Maya, Friday afternoon works for me.
              </div>
              <p>
                Turn spoken thoughts into editable text. Review the words before
                you use them.
              </p>
            </article>
            <article className={s.action} data-ui>
              <span>Action</span>
              <h3>Say it. Set it in motion.</h3>
              <p className={s.quote}>
                “Find a time with Maya on Friday and draft an invite.”
              </p>
              <ul>
                <li>
                  <Check size={18} /> Check the sample calendar
                </li>
                <li>
                  <Check size={18} /> Prepare Friday, 2:00–2:30 PM
                </li>
                <li>
                  <Check size={18} /> Draft the invite for your review
                </li>
              </ul>
              <p>
                Move across approved tools, with a visible plan and an approval
                gate.
              </p>
            </article>
          </div>
        </Section>
        <Section
          id="platforms"
          title="Your voice. Your device."
          subtitle="A deliberate rollout, starting with Windows. Capabilities will vary by platform and permissions."
        >
          <div className={s.platforms}>
            {platforms.map(([name, slug, status], i) => (
              <Link
                key={slug}
                href={`/platforms/${slug}`}
                className={s.platform}
              >
                {i < 3 ? <Monitor size={28} /> : <Smartphone size={28} />}
                <strong>{name}</strong>
                <span>{status}</span>
                <ArrowUpRight size={20} />
              </Link>
            ))}
          </div>
        </Section>
        <Section
          id="privacy"
          title="Permission is the point."
          subtitle="Explore the proposed privacy model. These switches illustrate data paths; they do not change your device permissions."
        >
          <PrivacyLab />
        </Section>
        <section
          id="pricing"
          className={s.pricing}
          aria-labelledby="price-heading"
        >
          <Container>
            <div className={s.priceLayout}>
              <div>
                <h2 id="price-heading">
                  A small start.
                  <br />A considered price.
                </h2>
                <p>Proposed PC introductory offer</p>
                <div className={s.price}>
                  ₹1<span>Terms in development</span>
                </div>
              </div>
              <div className={s.priceDetails}>
                <p>Try the idea today. Help shape what comes next.</p>
                <ul>
                  <li>Free browser demo, with sample data</li>
                  <li>PC billing period and offer duration: undecided</li>
                  <li>Usage caps, taxes and renewal: to be published</li>
                  <li>No payment collected. No unlimited AI promise.</li>
                </ul>
                <p>
                  Future mobile plan: separate pricing, still to be decided.
                </p>
                <Link href="/pricing" className={s.primary}>
                  Read the pricing details <ArrowUpRight size={18} />
                </Link>
              </div>
            </div>
          </Container>
        </section>
        <Section id="faq" title="A few good questions.">
          <Accordion items={questions} />
        </Section>
        <Section
          id="waitlist"
          title="Be part of the first wave."
          subtitle="Choose your platform and preview the signup. The connected waitlist is still in development; no registration is saved yet."
        >
          <WaitlistForm />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
